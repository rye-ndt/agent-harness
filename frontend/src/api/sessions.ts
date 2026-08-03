/**
 * The task-graph seam, and the only file that touches the session bindings.
 * Sessions are authored in this module's memory. Inside the Wails webview they
 * are hydrated from the stored drafts and every change is written back as one
 * JSON doc; finalizing builds a RunSessionSpec, starts the real run through the
 * generated bindings, and polls SessionStatus until the run settles. Outside
 * the webview (the plain vite dev server) there is no runtime, so the graph
 * starts from src/lib/mock-sessions.ts and finalizing falls back to a simulated
 * run that walks the graph in order.
 */

import {bridge, hasWailsRuntime} from '@/api/agents'
import {listTemplates} from '@/api/templates'
import {TaskLevel, TaskState} from '@/lib/enums'
import {mockOutcome, MOCK_SESSIONS} from '@/lib/mock-sessions'
import {
    createSession as buildSession,
    createTask as buildTask,
    createsCycle,
    duplicateSession,
    hasActiveTask,
    hasRunningTask,
    isRunnable,
    isSettled,
    withDependency,
    withTask,
    withTaskPatch,
    withoutDependency,
    withoutTask,
} from '@/lib/session'
import type {HandoverDoc, Point, Session, SessionDraft, Task, TaskDraft} from '@/types/session'
import {output_itf} from '../../wailsjs/go/models'
import {
    DeleteSessionDraft,
    RunSession,
    SaveSessionDraft,
    SessionDrafts,
    SessionStatus,
} from '../../wailsjs/go/wails_api/API'

const TICK_MS = 900

let sessions: Session[] = hasWailsRuntime() ? [] : structuredClone(MOCK_SESSIONS)

let hydrated = false

const timers = new Map<string, ReturnType<typeof setTimeout>>()

type RemoteRun = {
    remoteSessionId: string
    clientTaskIds: Map<string, string>
}

const runs = new Map<string, RemoteRun>()

function findSession(sessionId: string) {
    const session = sessions.find((session) => session.id === sessionId)
    if (!session) throw new Error('That session is gone. Pick another one from the rail.')
    return session
}

function findOpenSession(sessionId: string) {
    const session = findSession(sessionId)
    if (session.finalized) throw new Error('This session is finalized. Duplicate it to make changes.')
    return session
}

function findTask(session: Session, taskId: string) {
    const task = session.tasks.find((task) => task.id === taskId)
    if (!task) throw new Error('That task is gone. Pick another one on the canvas.')
    return task
}

function replaceSession(next: Session) {
    sessions = sessions.map((session) => (session.id === next.id ? next : session))
    void saveDraft(next).catch(() => {})
    return structuredClone(next)
}

async function saveDraft(session: Session) {
    if (!hasWailsRuntime()) return

    await bridge(() => SaveSessionDraft(session.id, JSON.stringify(session)))
}

async function hydrate() {
    if (hydrated || !hasWailsRuntime()) return

    const drafts = await bridge(SessionDrafts)
    sessions = drafts.map((draft) => resetUnfinished(JSON.parse(draft.doc) as Session))
    hydrated = true
}

function resetUnfinished(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            task.state === TaskState.Done || task.state === TaskState.Failed
                ? task
                : {
                      ...task,
                      state: session.finalized ? TaskState.Failed : TaskState.Idle,
                      run: undefined,
                      report: undefined,
                  },
        ),
    }
}

function label(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) => {
            if (isSettled(task.state)) return task
            return {...task, state: isRunnable(session, task) ? TaskState.Queued : TaskState.Blocked}
        }),
    }
}

function start(task: Task, now: number): Task {
    const {contextTotal, contextPeak} = mockOutcome(task)

    return {
        ...task,
        state: TaskState.Running,
        run: {
            ...task.run,
            startedAt: new Date(now).toISOString(),
            finishedAt: undefined,
            context: {used: Math.round(contextTotal * contextPeak * 0.2), total: contextTotal},
        },
    }
}

function progress(task: Task, now: number): Task {
    const outcome = mockOutcome(task)
    const startedAt = task.run?.startedAt ? Date.parse(task.run.startedAt) : now
    const share = Math.min(1, Math.max(0, (now - startedAt) / outcome.durationMs))
    const context = {
        used: Math.round(outcome.contextTotal * outcome.contextPeak * (0.2 + 0.8 * share)),
        total: outcome.contextTotal,
    }

    if (share < 1) return {...task, run: {...task.run, context}}

    return {
        ...task,
        state: outcome.state,
        run: {...task.run, finishedAt: new Date(now).toISOString(), context},
        report: outcome.report,
    }
}

function advance(session: Session): Session {
    const now = Date.now()

    const progressed = label({
        ...session,
        tasks: session.tasks.map((task) =>
            task.state === TaskState.Running ? progress(task, now) : task,
        ),
    })

    return label({
        ...progressed,
        tasks: progressed.tasks.map((task) =>
            isRunnable(progressed, task) ? start(task, now) : task,
        ),
    })
}

function tick(sessionId: string) {
    const session = sessions.find((session) => session.id === sessionId)
    if (!session?.finalized) return

    const next = replaceSession(advance(session))
    if (hasRunningTask(next)) schedule(sessionId)
}

function schedule(sessionId: string) {
    if (timers.has(sessionId)) return

    timers.set(
        sessionId,
        setTimeout(() => {
            timers.delete(sessionId)
            tick(sessionId)
        }, TICK_MS),
    )
}

function stopRun(sessionId: string) {
    const timer = timers.get(sessionId)
    if (timer === undefined) return

    clearTimeout(timer)
    timers.delete(sessionId)
}

function resolvedPrompt(task: Task) {
    const entries = Object.entries(task.values ?? {}).filter(([, value]) => String(value) !== '')
    if (entries.length === 0) return task.prompt

    const lines = entries.map(([key, value]) => `- ${key}: ${String(value)}`)
    return `${task.prompt}\n\nInputs:\n${lines.join('\n')}`
}

async function buildRunSpec(session: Session): Promise<output_itf.RunSessionSpec> {
    const templates = await listTemplates()
    const templateById = new Map(templates.map((template) => [template.id, template]))

    return new output_itf.RunSessionSpec({
        working_dir_path: session.workingDir.trim(),
        context_dir_path: session.contextDir.trim(),
        tasks: session.tasks.map((task) => {
            const template = task.templateId ? templateById.get(task.templateId) : undefined
            return {
                client_id: task.id,
                name: task.title,
                prompt: resolvedPrompt(task),
                role: template?.role ?? '',
                task_level: template?.taskLevel ?? TaskLevel.Daily,
                system_prompts: template?.systemPrompts.map((prompt) => prompt.value) ?? [],
                depends_on: [...task.dependsOn],
                auto_retry: false,
            }
        }),
    })
}

async function startRemoteRun(session: Session): Promise<boolean> {
    if (!hasWailsRuntime()) return false
    if (runs.has(session.id)) return true
    if (!session.workingDir.trim())
        throw new Error('Set a working directory before running this session.')

    const spec = await buildRunSpec(session)
    const result = await RunSession(spec)
    const clientTaskIds = new Map(
        Object.entries(result.task_ids ?? {}).map(([clientId, remoteId]) => [remoteId, clientId]),
    )

    runs.set(session.id, {remoteSessionId: result.session_id, clientTaskIds})
    pollRemoteRun(session.id)
    return true
}

function pollRemoteRun(sessionId: string) {
    if (timers.has(sessionId)) return

    timers.set(
        sessionId,
        setTimeout(() => {
            timers.delete(sessionId)
            void pollRemoteTick(sessionId)
        }, TICK_MS),
    )
}

async function pollRemoteTick(sessionId: string) {
    const run = runs.get(sessionId)
    const session = sessions.find((session) => session.id === sessionId)
    if (!run || !session) return

    try {
        const status = await SessionStatus(run.remoteSessionId)
        const next = replaceSession(applyRemoteStatus(session, run, status))
        if (!hasActiveTask(next)) {
            runs.delete(sessionId)
            return
        }
    } catch {}

    pollRemoteRun(sessionId)
}

const REMOTE_STATES: Record<string, TaskState> = {
    processing: TaskState.Running,
    completed: TaskState.Done,
    failed: TaskState.Failed,
    cancelled: TaskState.Failed,
}

function applyRemoteStatus(
    session: Session,
    run: RemoteRun,
    status: output_itf.SessionStatusInfo,
): Session {
    const now = new Date().toISOString()
    const infoByClientId = new Map(
        (status.tasks ?? []).map((info) => [run.clientTaskIds.get(info.task_id), info]),
    )

    return label({
        ...session,
        tasks: session.tasks.map((task) => {
            const info = infoByClientId.get(task.id)
            return info ? applyRemoteTask(task, info, now) : task
        }),
    })
}

function applyRemoteTask(task: Task, info: output_itf.SessionTaskInfo, now: string): Task {
    const state = REMOTE_STATES[info.status]
    if (!state) return task

    const startedAt = task.run?.startedAt ?? now
    const finishedAt = state === TaskState.Running ? undefined : (task.run?.finishedAt ?? now)

    return {
        ...task,
        state,
        run: {...task.run, startedAt, finishedAt},
        report:
            state === TaskState.Running
                ? task.report
                : {
                      status: state,
                      fileChanges: [],
                      handoverDocs: (info.handover_docs ?? []).map(toHandoverDoc),
                  },
    }
}

function toHandoverDoc(info: output_itf.HandoverDocInfo): HandoverDoc {
    return {
        task: info.task ?? '',
        outcome: info.outcome ?? '',
        blockers: info.blockers ?? {},
        approvedDecisions: info.approved_decisions ?? {},
        rejectedDecisions: info.rejected_decisions ?? {},
        currentBehaviors: info.current_behaviors ?? {},
        changedBehaviors: info.changed_behaviors ?? {},
        mustAvoid: info.must_avoid ?? {},
        nuances: info.nuances ?? {},
        knownGaps: info.known_gaps ?? {},
    }
}

for (const session of sessions) if (hasRunningTask(session)) schedule(session.id)

export async function listSessions(): Promise<Session[]> {
    await hydrate()
    return structuredClone(sessions)
}

export async function createSession(sessionId: string, draft: SessionDraft): Promise<Session> {
    if (!draft.workingDir.trim()) throw new Error('A session needs a working directory.')
    if (!draft.contextDir.trim()) throw new Error('A session needs a context directory.')

    await hydrate()

    const session = {...buildSession(draft), id: sessionId}
    sessions = [session, ...sessions]
    await saveDraft(session)

    return structuredClone(session)
}

export async function cloneSession(sourceId: string, sessionId: string): Promise<Session> {
    await hydrate()

    const copy = {...duplicateSession(findSession(sourceId)), id: sessionId}
    sessions = [copy, ...sessions]
    await saveDraft(copy)

    return structuredClone(copy)
}

export async function updateSession(
    sessionId: string,
    patch: Partial<Pick<Session, 'name' | 'finalized' | 'workingDir' | 'contextDir'>>,
): Promise<Session> {
    if (patch.finalized === false)
        throw new Error('A finalized session cannot go back to a draft. Duplicate it instead.')

    if (patch.workingDir !== undefined && !patch.workingDir.trim())
        throw new Error('A session needs a working directory.')

    if (patch.contextDir !== undefined && !patch.contextDir.trim())
        throw new Error('A session needs a context directory.')

    await hydrate()

    const session = patch.finalized ? findSession(sessionId) : findOpenSession(sessionId)
    const started = patch.finalized ? await startRemoteRun({...session, ...patch}) : false

    replaceSession({...session, ...patch})

    if (patch.finalized && !started) tick(sessionId)

    return structuredClone(findSession(sessionId))
}

export async function deleteSession(sessionId: string): Promise<void> {
    await hydrate()

    stopRun(sessionId)
    runs.delete(sessionId)
    sessions = sessions.filter((session) => session.id !== sessionId)

    if (hasWailsRuntime()) await bridge(() => DeleteSessionDraft(sessionId))
}

export async function createTask(
    sessionId: string,
    taskId: string,
    draft: TaskDraft,
    position: Point,
): Promise<Task> {
    await hydrate()

    const session = findOpenSession(sessionId)
    const task = {...buildTask(draft, position), id: taskId}
    replaceSession(withTask(session, task))
    return structuredClone(task)
}

export async function updateTask(
    sessionId: string,
    taskId: string,
    patch: Partial<Task>,
): Promise<Task> {
    await hydrate()

    const session = findOpenSession(sessionId)
    const next = {...findTask(session, taskId), ...patch, id: taskId}
    replaceSession(withTaskPatch(session, taskId, patch))
    return structuredClone(next)
}

export async function deleteTask(sessionId: string, taskId: string): Promise<void> {
    await hydrate()
    replaceSession(withoutTask(findOpenSession(sessionId), taskId))
}

export async function addDependency(
    sessionId: string,
    sourceId: string,
    targetId: string,
): Promise<void> {
    await hydrate()

    const session = findOpenSession(sessionId)
    if (createsCycle(session.tasks, sourceId, targetId))
        throw new Error('That link would loop back on itself. Point it at another task.')

    replaceSession(withDependency(session, sourceId, targetId))
}

export async function removeDependency(
    sessionId: string,
    sourceId: string,
    targetId: string,
): Promise<void> {
    await hydrate()
    replaceSession(withoutDependency(findOpenSession(sessionId), sourceId, targetId))
}
