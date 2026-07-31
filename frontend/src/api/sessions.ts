/**
 * Stand-in for the Go task-graph API, which does not exist yet — the backend's
 * FEAPI port is agent-lifecycle only. Sessions live in this module's memory.
 * When the real Wails bindings land, this is the only file that changes.
 */

import {MOCK_SESSIONS} from '@/lib/mock-sessions'
import {
    createSession as buildSession,
    createTask as buildTask,
    createsCycle,
    duplicateSession,
} from '@/lib/session'
import type {Point, Session, Task} from '@/types/session'

let sessions: Session[] = structuredClone(MOCK_SESSIONS)

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
    const locks = Object.keys(patch).every((key) => key === 'finalized')
    const session = locks ? findSession(sessionId) : findOpenSession(sessionId)
    return replaceSession({...session, ...patch})
}

export async function deleteSession(sessionId: string): Promise<void> {
    sessions = sessions.filter((session) => session.id !== sessionId)
}

export async function createTask(
    sessionId: string,
    taskId: string,
    position: Point,
): Promise<Task> {
    const session = findOpenSession(sessionId)
    const task = {...buildTask(position, session.tasks.length), id: taskId}
    replaceSession({...session, tasks: [...session.tasks, task]})
    return structuredClone(task)
}

export async function updateTask(
    sessionId: string,
    taskId: string,
    patch: Partial<Task>,
): Promise<Task> {
    const session = findOpenSession(sessionId)
    const next = {...findTask(session, taskId), ...patch, id: taskId}
    replaceSession({
        ...session,
        tasks: session.tasks.map((task) => (task.id === taskId ? next : task)),
    })
    return structuredClone(next)
}

export async function deleteTask(sessionId: string, taskId: string): Promise<void> {
    const session = findOpenSession(sessionId)
    replaceSession({
        ...session,
        tasks: session.tasks
            .filter((task) => task.id !== taskId)
            .map((task) => ({
                ...task,
                dependsOn: task.dependsOn.filter((id) => id !== taskId),
            })),
    })
}

export async function addDependency(
    sessionId: string,
    sourceId: string,
    targetId: string,
): Promise<void> {
    const session = findOpenSession(sessionId)
    if (createsCycle(session.tasks, sourceId, targetId))
        throw new Error('That link would loop back on itself. Point it at another task.')

    replaceSession({
        ...session,
        tasks: session.tasks.map((task) =>
            task.id === targetId && !task.dependsOn.includes(sourceId)
                ? {...task, dependsOn: [...task.dependsOn, sourceId]}
                : task,
        ),
    })
}

export async function removeDependency(
    sessionId: string,
    sourceId: string,
    targetId: string,
): Promise<void> {
    const session = findOpenSession(sessionId)
    replaceSession({
        ...session,
        tasks: session.tasks.map((task) =>
            task.id === targetId
                ? {...task, dependsOn: task.dependsOn.filter((id) => id !== sourceId)}
                : task,
        ),
    })
}
