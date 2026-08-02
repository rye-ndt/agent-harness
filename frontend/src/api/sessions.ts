/**
 * Stand-in for the Go task-graph API, which does not exist yet — the backend's
 * FEAPI port is agent-lifecycle only. Sessions live in this module's memory,
 * and finalizing one starts a simulated run that walks the graph in order.
 * When the real Wails bindings land, this is the only file that changes.
 */

import {TaskState} from '@/lib/enums'
import {mockOutcome, MOCK_SESSIONS} from '@/lib/mock-sessions'
import {
    createSession as buildSession,
    createTask as buildTask,
    createsCycle,
    duplicateSession,
    hasRunningTask,
    isRunnable,
    isSettled,
    withDependency,
    withTask,
    withTaskPatch,
    withoutDependency,
    withoutTask,
} from '@/lib/session'
import type {Point, Session, Task, TaskDraft} from '@/types/session'

const TICK_MS = 900

let sessions: Session[] = structuredClone(MOCK_SESSIONS)

const timers = new Map<string, ReturnType<typeof setTimeout>>()

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
    return structuredClone(next)
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

for (const session of sessions) if (hasRunningTask(session)) schedule(session.id)

export async function listSessions(): Promise<Session[]> {
    return structuredClone(sessions)
}

export async function createSession(sessionId: string): Promise<Session> {
    const session = {...buildSession(sessions.length), id: sessionId}
    sessions = [session, ...sessions]
    return structuredClone(session)
}

export async function cloneSession(sourceId: string, sessionId: string): Promise<Session> {
    const copy = {...duplicateSession(findSession(sourceId)), id: sessionId}
    sessions = [copy, ...sessions]
    return structuredClone(copy)
}

export async function updateSession(
    sessionId: string,
    patch: Partial<Pick<Session, 'name' | 'finalized'>>,
): Promise<Session> {
    if (patch.finalized === false)
        throw new Error('A finalized session cannot go back to a draft. Duplicate it instead.')

    const session = patch.finalized ? findSession(sessionId) : findOpenSession(sessionId)
    replaceSession({...session, ...patch})

    if (patch.finalized) tick(sessionId)

    return structuredClone(findSession(sessionId))
}

export async function deleteSession(sessionId: string): Promise<void> {
    stopRun(sessionId)
    sessions = sessions.filter((session) => session.id !== sessionId)
}

export async function createTask(
    sessionId: string,
    taskId: string,
    draft: TaskDraft,
    position: Point,
): Promise<Task> {
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
    const session = findOpenSession(sessionId)
    const next = {...findTask(session, taskId), ...patch, id: taskId}
    replaceSession(withTaskPatch(session, taskId, patch))
    return structuredClone(next)
}

export async function deleteTask(sessionId: string, taskId: string): Promise<void> {
    replaceSession(withoutTask(findOpenSession(sessionId), taskId))
}

export async function addDependency(
    sessionId: string,
    sourceId: string,
    targetId: string,
): Promise<void> {
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
    replaceSession(withoutDependency(findOpenSession(sessionId), sourceId, targetId))
}
