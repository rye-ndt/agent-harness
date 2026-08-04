/**
 * The task-graph seam. Sessions are authored in this module's memory: inside
 * the Wails webview they are hydrated from the stored drafts and finalizing
 * starts the real run over the bindings; outside the webview (the plain vite
 * dev server) finalizing falls back to a simulated run.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {
    createSession as buildSession,
    createTask as buildTask,
    createsCycle,
    duplicateSession,
    label,
    withDependency,
    withTask,
    withTaskPatch,
    withoutDependency,
    withoutTask,
} from '@/features/sessions/graph'
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
import {stopRun, tick} from '@/features/sessions/api/simulated-run'
import {runs, startRemoteRun} from '@/features/sessions/api/remote-run'
import {DeleteSessionDraft} from '@wailsjs/go/wails_api/API'

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

    replaceSession(patch.finalized ? label({...session, ...patch}) : {...session, ...patch})

    if (patch.finalized && !started) tick(sessionId)

    return structuredClone(findSession(sessionId))
}

export async function deleteSession(sessionId: string): Promise<void> {
    await hydrate()

    stopRun(sessionId)
    runs.delete(sessionId)
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
