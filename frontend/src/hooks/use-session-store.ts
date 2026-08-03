import {useState} from 'react'

import {useSessions} from '@/hooks/use-sessions'
import * as graph from '@/lib/session'
import type {Point, Task, TaskDraft} from '@/types/session'

/**
 * Single source of truth for the session graph. Sessions are server state and
 * live in the query cache; the active session and the selected task are view
 * state and stay local.
 */
export function useSessionStore() {
    const store = useSessions()
    const {sessions} = store

    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    const activeSession = graph.findSession(sessions, selectedSessionId) ?? sessions[0] ?? null
    const activeSessionId = activeSession?.id ?? null

    const openSession = (sessionId: string) => {
        const session = graph.findSession(sessions, sessionId)
        return session && !session.finalized ? session : null
    }

    const selectSession = (sessionId: string | null) => {
        setSelectedSessionId(sessionId)
        setSelectedTaskId(null)
    }

    const selectTask = (taskId: string | null) => {
        setSelectedTaskId(taskId)
    }

    const addSession = () => {
        const sessionId = crypto.randomUUID()
        store.createSession({sessionId})
        selectSession(sessionId)
    }

    const cloneSession = (sourceId: string) => {
        const sessionId = crypto.randomUUID()
        store.cloneSession({sourceId, sessionId})
        selectSession(sessionId)
    }

    const renameSession = (sessionId: string, name: string) => {
        store.renameSession({sessionId, name})
    }

    const setWorkingDir = (sessionId: string, workingDir: string) => {
        store.setSessionWorkingDir({sessionId, workingDir})
    }

    const finalizeSession = (sessionId: string) => {
        store.finalizeSession({sessionId})
    }

    const deleteSession = (sessionId: string) => {
        store.deleteSession({sessionId})
        if (selectedSessionId === sessionId) selectSession(null)
    }

    const addTask = (sessionId: string, draft: TaskDraft, position: Point) => {
        if (!openSession(sessionId)) return

        const taskId = crypto.randomUUID()
        store.createTask({sessionId, taskId, draft, position})
        setSelectedTaskId(taskId)
    }

    const updateTask = (sessionId: string, taskId: string, patch: Partial<Task>) => {
        store.updateTask({sessionId, taskId, patch})
    }

    const moveTask = (sessionId: string, taskId: string, position: Point) => {
        store.updateTask({sessionId, taskId, patch: {position}})
    }

    const removeTask = (sessionId: string, taskId: string) => {
        store.deleteTask({sessionId, taskId})
        if (selectedTaskId === taskId) setSelectedTaskId(null)
    }

    const connectTasks = (sessionId: string, sourceId: string, targetId: string) => {
        const session = openSession(sessionId)
        if (!session || graph.createsCycle(session.tasks, sourceId, targetId)) return

        store.connectTasks({sessionId, sourceId, targetId})
    }

    const disconnectTasks = (sessionId: string, sourceId: string, targetId: string) => {
        store.disconnectTasks({sessionId, sourceId, targetId})
    }

    return {
        sessions,
        activeSession,
        activeSessionId,
        selectedTaskId,
        selectSession,
        selectTask,
        addSession,
        cloneSession,
        renameSession,
        setWorkingDir,
        finalizeSession,
        deleteSession,
        addTask,
        updateTask,
        moveTask,
        removeTask,
        connectTasks,
        disconnectTasks,
    }
}

export type SessionStore = ReturnType<typeof useSessionStore>
