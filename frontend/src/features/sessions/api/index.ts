/**
 * The task-graph seam. Sessions are authored in this module's memory: inside
 * the Wails webview they are hydrated from the stored drafts and running one
 * starts the real run over the bindings; outside the webview (the plain vite
 * dev server) it falls back to a simulated run. Finalizing only locks the
 * graph — the run waits for an explicit start, and inputs stay editable until
 * it happens.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {TaskState} from '@/shared/lib/enums'
import {
    createSession as buildSession,
    createTask as buildTask,
    cancelRun,
    createsCycle,
    duplicateSession,
    label,
    withDependency,
    withTask,
    withTaskPatch,
    withoutDependency,
    withoutTask,
} from '@/features/sessions/graph'
import {MISSING_INPUTS_MESSAGE, missingInputs} from '@/features/sessions/task-inputs'
import {cachedTemplates, listTemplates} from '@/features/templates/api'
import type {ParamValue} from '@/features/templates/types'
import type {Point, Session, SessionDraft, Task, TaskDraft} from '@/features/sessions/types'
import {
    findOpenSession,
    findSession,
    findTask,
    hydrate,
    replaceSession,
    saveDraft,
    sessions,
    setSessions,
} from '@/features/sessions/api/store'
import {forgetSessionActivity} from '@/features/sessions/api/activity'
import {resolveAcceptance, stopRun, tick} from '@/features/sessions/api/simulated-run'
import {
    answerRemoteAcceptance,
    cancelRemoteRun,
    runs,
    startRemoteRun,
} from '@/features/sessions/api/remote-run'
import {DeleteSessionDraft} from '@wailsjs/go/wails_api/API'

export {taskActivity} from '@/features/sessions/api/activity'

export async function listSessions(): Promise<Session[]> {
    await hydrate()
    return structuredClone(sessions)
}

export async function createSession(sessionId: string, draft: SessionDraft): Promise<Session> {
    if (!draft.workingDir.trim()) throw new Error('A session needs a working directory.')
    if (!draft.contextDir.trim()) throw new Error('A session needs a context directory.')

    await hydrate()

    const session = {...buildSession(draft), id: sessionId}
    setSessions([session, ...sessions])
    await saveDraft(session)

    return structuredClone(session)
}

export async function cloneSession(sourceId: string, sessionId: string): Promise<Session> {
    await hydrate()

    const copy = {...duplicateSession(findSession(sourceId)), id: sessionId}
    setSessions([copy, ...sessions])
    await saveDraft(copy)

    return structuredClone(copy)
}

export async function updateSession(
    sessionId: string,
    patch: Partial<Pick<Session, 'name' | 'finalized' | 'started' | 'workingDir' | 'contextDir'>>,
): Promise<Session> {
    if (patch.finalized === false)
        throw new Error('A finalized session cannot go back to a draft. Duplicate it instead.')

    if (patch.workingDir !== undefined && !patch.workingDir.trim())
        throw new Error('A session needs a working directory.')

    if (patch.contextDir !== undefined && !patch.contextDir.trim())
        throw new Error('A session needs a context directory.')

    await hydrate()

    const locking = patch.finalized || patch.started
    const session = locking ? findSession(sessionId) : findOpenSession(sessionId)

    if (patch.started && !session.finalized)
        throw new Error('Finalize the session before running it.')

    if (patch.started && session.cancelled)
        throw new Error('This run was cancelled. Duplicate the session to run it again.')

    if (!patch.started) {
        replaceSession({...session, ...patch})
        return structuredClone(findSession(sessionId))
    }

    await listTemplates()

    if (missingInputs(session, cachedTemplates()).length > 0)
        throw new Error(MISSING_INPUTS_MESSAGE)

    await startRun(label({...session, ...patch}))

    return structuredClone(findSession(sessionId))
}

async function startRun(session: Session) {
    if (!hasWailsRuntime()) {
        replaceSession(session)
        tick(session.id)
        return
    }

    await startRemoteRun(replaceSession(session))
}

/** Inputs are editable on the node until the run starts, finalized or not. */
export async function setTaskInputs(
    sessionId: string,
    taskId: string,
    values: Record<string, ParamValue>,
): Promise<Task> {
    await hydrate()

    const session = findSession(sessionId)
    if (session.started) throw new Error('This session is running. Its inputs are locked.')

    const task = findTask(session, taskId)
    replaceSession(withTaskPatch(session, taskId, {values: {...task.values, ...values}}))

    return structuredClone(findTask(findSession(sessionId), taskId))
}

/** Answers the gate a finished node is holding: confirm releases downstream, reject fails the node. */
export async function answerTaskAcceptance(
    sessionId: string,
    taskId: string,
    accepted: boolean,
): Promise<Session> {
    await hydrate()

    const session = findSession(sessionId)
    const task = findTask(session, taskId)

    if (task.state !== TaskState.AwaitingAccept)
        throw new Error(
            'This node is not waiting to be accepted. It may already have been answered.',
        )

    if (hasWailsRuntime()) await answerRemoteAcceptance(sessionId, taskId, accepted)
    else resolveAcceptance(sessionId, taskId, accepted)

    return structuredClone(findSession(sessionId))
}

/** Cancel is terminal — the node that was running loses its work and the session can only be duplicated. */
export async function cancelSession(sessionId: string): Promise<Session> {
    await hydrate()

    const session = findSession(sessionId)
    if (!session.started) throw new Error('This session is not running.')
    if (session.cancelled) return structuredClone(session)

    stopRun(sessionId)
    await cancelRemoteRun(sessionId)
    forgetSessionActivity(session)

    return replaceSession(cancelRun(session))
}

export async function deleteSession(sessionId: string): Promise<void> {
    await hydrate()

    const doomed = sessions.find((session) => session.id === sessionId)

    stopRun(sessionId)
    await cancelRemoteRun(sessionId).catch(() => {})
    runs.delete(sessionId)
    if (doomed) forgetSessionActivity(doomed)
    setSessions(sessions.filter((session) => session.id !== sessionId))

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
