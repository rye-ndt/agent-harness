/**
 * Finalizing builds a RunSessionSpec, starts the real run through the
 * generated bindings, and polls SessionStatus until the run settles. A node
 * that asks for manual acceptance halts in awaiting_accept until the answer
 * goes back over the same bindings.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {listTemplates} from '@/features/templates/api'
import {FileChangeType, TaskLevel, TaskState} from '@/shared/lib/enums'
import {hasActiveTask, isFinished, label} from '@/features/sessions/graph'
import {resolvedPrompt} from '@/features/sessions/task-inputs'
import type {FileChange, HandoverDoc, Session, Task} from '@/features/sessions/types'
import {replaceSession, sessions} from '@/features/sessions/api/store'
import {TICK_MS, timers} from '@/features/sessions/api/timers'
import {output_itf} from '@wailsjs/go/models'
import {
    AnswerTaskAcceptance,
    CancelSession,
    RunSession,
    SessionStatus,
} from '@wailsjs/go/wails_api/API'

const MAX_FAILED_POLLS = 5

type RemoteRun = {
    remoteSessionId: string
    clientTaskIds: Map<string, string>
    failedPolls: number
}

export const runs = new Map<string, RemoteRun>()

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
                manual_accept_required: template?.manualAcceptRequired ?? false,
            }
        }),
    })
}

export async function startRemoteRun(session: Session): Promise<boolean> {
    if (!hasWailsRuntime()) return false
    if (runs.has(session.id)) return true
    if (!session.workingDir.trim())
        throw new Error('Set a working directory before running this session.')

    const spec = await buildRunSpec(session)
    const result = await RunSession(spec)
    const clientTaskIds = new Map(
        Object.entries(result.task_ids ?? {}).map(([clientId, remoteId]) => [remoteId, clientId]),
    )

    if (!result.session_id)
        throw new Error('The run started without a session id. Check the app log and try again.')

    runs.set(session.id, {remoteSessionId: result.session_id, clientTaskIds, failedPolls: 0})
    pollRemoteRun(session.id)
    return true
}

export async function answerRemoteAcceptance(
    sessionId: string,
    taskId: string,
    accepted: boolean,
): Promise<void> {
    const run = runs.get(sessionId)
    if (!run) throw new Error('This run is no longer being tracked. Reopen the session first.')

    const match = [...run.clientTaskIds].find(([, clientId]) => clientId === taskId)
    if (!match) throw new Error('That node is not part of the running session.')

    const [remoteTaskId] = match

    await bridge(() => AnswerTaskAcceptance(remoteTaskId, accepted))
    pollRemoteRun(sessionId)
}

export async function cancelRemoteRun(sessionId: string): Promise<void> {
    const run = runs.get(sessionId)
    if (!run) return

    await bridge(() => CancelSession(run.remoteSessionId))
    runs.delete(sessionId)
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
    if (!run || !session || session.cancelled) return

    let status: output_itf.SessionStatusInfo | null = null

    try {
        status = await bridge(() => SessionStatus(run.remoteSessionId))
    } catch {
        run.failedPolls += 1

        if (run.failedPolls >= MAX_FAILED_POLLS) {
            runs.delete(sessionId)
            replaceSession(loseRun(session))
            return
        }
    }

    if (status) {
        run.failedPolls = 0

        const next = replaceSession(applyRemoteStatus(session, run, status))
        if (!hasActiveTask(next)) {
            runs.delete(sessionId)
            return
        }
    }

    pollRemoteRun(sessionId)
}

function loseRun(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            isFinished(task.state) ? task : {...task, state: TaskState.Failed},
        ),
    }
}

const REMOTE_STATES: Record<string, TaskState> = {
    processing: TaskState.Running,
    awaiting_accept: TaskState.AwaitingAccept,
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
                      fileChanges: (info.file_changes ?? []).map(toFileChange),
                      handoverDocs: (info.handover_docs ?? []).map(toHandoverDoc),
                  },
    }
}

const REMOTE_CHANGE_TYPES: Record<string, FileChangeType> = {
    added: FileChangeType.Created,
    modified: FileChangeType.Modified,
    deleted: FileChangeType.Deleted,
    renamed: FileChangeType.Renamed,
}

function toFileChange(info: output_itf.FileChangeInfo): FileChange {
    return {
        path: info.path ?? '',
        oldPath: info.old_path ?? '',
        changeType: REMOTE_CHANGE_TYPES[info.change_type] ?? FileChangeType.Modified,
        additions: info.additions ?? 0,
        deletions: info.deletions ?? 0,
        unifiedDiff: info.unified_diff ?? '',
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
