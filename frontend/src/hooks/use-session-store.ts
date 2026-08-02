import {useCallback, useMemo, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/api/sessions'
import {
    createSession,
    createTask,
    createsCycle,
    duplicateSession,
    hasRunningTask,
} from '@/lib/session'
import type {Point, Session, Task, TaskDraft} from '@/types/session'

const SESSIONS_KEY = ['sessions']

const RUN_POLL_MS = 900

function editSession(sessions: Session[], sessionId: string, edit: (session: Session) => Session) {
    return sessions.map((session) =>
        session.id === sessionId && !session.finalized ? edit(session) : session,
    )
}

function editTasks(sessions: Session[], sessionId: string, edit: (tasks: Task[]) => Task[]) {
    return editSession(sessions, sessionId, (session) => ({...session, tasks: edit(session.tasks)}))
}

function useSessionMutation<TArgs>(
    mutationFn: (args: TArgs) => Promise<unknown>,
    optimistic: (sessions: Session[], args: TArgs) => Session[],
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn,
        onMutate: async (args: TArgs) => {
            const previous = queryClient.getQueryData<Session[]>(SESSIONS_KEY) ?? []
            queryClient.setQueryData<Session[]>(SESSIONS_KEY, optimistic(previous, args))
            await queryClient.cancelQueries({queryKey: SESSIONS_KEY})
            return {previous}
        },
        onError: (_error, _args, context) => {
            if (context) queryClient.setQueryData<Session[]>(SESSIONS_KEY, context.previous)
        },
        onSettled: () => {
            queryClient.invalidateQueries({queryKey: SESSIONS_KEY})
        },
    })
}

/**
 * Single source of truth for the session graph. Sessions are server state and
 * live in the query cache; the active session and the selected task are view
 * state and stay local.
 */
export function useSessionStore() {
    const {data} = useQuery({
        queryKey: SESSIONS_KEY,
        queryFn: api.listSessions,
        refetchInterval: (query) =>
            query.state.data?.some(hasRunningTask) ? RUN_POLL_MS : false,
    })
    const sessions = data ?? []

    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    const activeSessionId = useMemo(() => {
        if (sessions.some((session) => session.id === selectedSessionId)) return selectedSessionId
        return sessions[0]?.id ?? null
    }, [sessions, selectedSessionId])

    const activeSession = useMemo(
        () => sessions.find((session) => session.id === activeSessionId) ?? null,
        [sessions, activeSessionId],
    )

    const {mutate: createSessionOnServer} = useSessionMutation(
        (args: {sessionId: string}) => api.createSession(args.sessionId),
        (sessions, {sessionId}) => [{...createSession(sessions.length), id: sessionId}, ...sessions],
    )

    const {mutate: cloneSessionOnServer} = useSessionMutation(
        (args: {sourceId: string; sessionId: string}) =>
            api.cloneSession(args.sourceId, args.sessionId),
        (sessions, {sourceId, sessionId}) => {
            const source = sessions.find((session) => session.id === sourceId)
            if (!source) return sessions
            return [{...duplicateSession(source), id: sessionId}, ...sessions]
        },
    )

    const {mutate: renameSessionOnServer} = useSessionMutation(
        (args: {sessionId: string; name: string}) =>
            api.updateSession(args.sessionId, {name: args.name}),
        (sessions, {sessionId, name}) =>
            editSession(sessions, sessionId, (session) => ({...session, name})),
    )

    const {mutate: finalizeSessionOnServer} = useSessionMutation(
        (args: {sessionId: string}) => api.updateSession(args.sessionId, {finalized: true}),
        (sessions, {sessionId}) =>
            sessions.map((session) =>
                session.id === sessionId ? {...session, finalized: true} : session,
            ),
    )

    const {mutate: deleteSessionOnServer} = useSessionMutation(
        (args: {sessionId: string}) => api.deleteSession(args.sessionId),
        (sessions, {sessionId}) => sessions.filter((session) => session.id !== sessionId),
    )

    const {mutate: createTaskOnServer} = useSessionMutation(
        (args: {sessionId: string; taskId: string; draft: TaskDraft; position: Point}) =>
            api.createTask(args.sessionId, args.taskId, args.draft, args.position),
        (sessions, {sessionId, taskId, draft, position}) =>
            editSession(sessions, sessionId, (session) => ({
                ...session,
                tasks: [...session.tasks, {...createTask(draft, position), id: taskId}],
            })),
    )

    const {mutate: updateTaskOnServer} = useSessionMutation(
        (args: {sessionId: string; taskId: string; patch: Partial<Task>}) =>
            api.updateTask(args.sessionId, args.taskId, args.patch),
        (sessions, {sessionId, taskId, patch}) =>
            editTasks(sessions, sessionId, (tasks) =>
                tasks.map((task) => (task.id === taskId ? {...task, ...patch} : task)),
            ),
    )

    const {mutate: deleteTaskOnServer} = useSessionMutation(
        (args: {sessionId: string; taskId: string}) => api.deleteTask(args.sessionId, args.taskId),
        (sessions, {sessionId, taskId}) =>
            editTasks(sessions, sessionId, (tasks) =>
                tasks
                    .filter((task) => task.id !== taskId)
                    .map((task) => ({
                        ...task,
                        dependsOn: task.dependsOn.filter((id) => id !== taskId),
                    })),
            ),
    )

    const {mutate: addDependencyOnServer} = useSessionMutation(
        (args: {sessionId: string; sourceId: string; targetId: string}) =>
            api.addDependency(args.sessionId, args.sourceId, args.targetId),
        (sessions, {sessionId, sourceId, targetId}) =>
            editTasks(sessions, sessionId, (tasks) => {
                if (createsCycle(tasks, sourceId, targetId)) return tasks

                return tasks.map((task) =>
                    task.id === targetId && !task.dependsOn.includes(sourceId)
                        ? {...task, dependsOn: [...task.dependsOn, sourceId]}
                        : task,
                )
            }),
    )

    const {mutate: removeDependencyOnServer} = useSessionMutation(
        (args: {sessionId: string; sourceId: string; targetId: string}) =>
            api.removeDependency(args.sessionId, args.sourceId, args.targetId),
        (sessions, {sessionId, sourceId, targetId}) =>
            editTasks(sessions, sessionId, (tasks) =>
                tasks.map((task) =>
                    task.id === targetId
                        ? {...task, dependsOn: task.dependsOn.filter((id) => id !== sourceId)}
                        : task,
                ),
            ),
    )

    const isOpen = useCallback(
        (sessionId: string) => {
            const session = sessions.find((session) => session.id === sessionId)
            return Boolean(session && !session.finalized)
        },
        [sessions],
    )

    const selectSession = useCallback((sessionId: string) => {
        setSelectedSessionId(sessionId)
        setSelectedTaskId(null)
    }, [])

    const selectTask = useCallback((taskId: string | null) => {
        setSelectedTaskId(taskId)
    }, [])

    const addSession = useCallback(() => {
        const sessionId = crypto.randomUUID()
        createSessionOnServer({sessionId})
        setSelectedSessionId(sessionId)
        setSelectedTaskId(null)
    }, [createSessionOnServer])

    const cloneSession = useCallback(
        (sourceId: string) => {
            const sessionId = crypto.randomUUID()
            cloneSessionOnServer({sourceId, sessionId})
            setSelectedSessionId(sessionId)
            setSelectedTaskId(null)
        },
        [cloneSessionOnServer],
    )

    const renameSession = useCallback(
        (sessionId: string, name: string) => {
            renameSessionOnServer({sessionId, name})
        },
        [renameSessionOnServer],
    )

    const finalizeSession = useCallback(
        (sessionId: string) => {
            finalizeSessionOnServer({sessionId})
        },
        [finalizeSessionOnServer],
    )

    const deleteSession = useCallback(
        (sessionId: string) => {
            deleteSessionOnServer({sessionId})
            setSelectedSessionId((current) =>
                current === sessionId
                    ? (sessions.find((session) => session.id !== sessionId)?.id ?? null)
                    : current,
            )
            setSelectedTaskId(null)
        },
        [sessions, deleteSessionOnServer],
    )

    const addTask = useCallback(
        (sessionId: string, draft: TaskDraft, position: Point) => {
            if (!isOpen(sessionId)) return

            const taskId = crypto.randomUUID()
            createTaskOnServer({sessionId, taskId, draft, position})
            setSelectedTaskId(taskId)
        },
        [isOpen, createTaskOnServer],
    )

    const updateTask = useCallback(
        (sessionId: string, taskId: string, patch: Partial<Task>) => {
            updateTaskOnServer({sessionId, taskId, patch})
        },
        [updateTaskOnServer],
    )

    const moveTask = useCallback(
        (sessionId: string, taskId: string, position: Point) => {
            updateTaskOnServer({sessionId, taskId, patch: {position}})
        },
        [updateTaskOnServer],
    )

    const removeTask = useCallback(
        (sessionId: string, taskId: string) => {
            deleteTaskOnServer({sessionId, taskId})
            setSelectedTaskId((current) => (current === taskId ? null : current))
        },
        [deleteTaskOnServer],
    )

    const connectTasks = useCallback(
        (sessionId: string, sourceId: string, targetId: string) => {
            const session = sessions.find((session) => session.id === sessionId)
            if (!session || createsCycle(session.tasks, sourceId, targetId)) return

            addDependencyOnServer({sessionId, sourceId, targetId})
        },
        [sessions, addDependencyOnServer],
    )

    const disconnectTasks = useCallback(
        (sessionId: string, sourceId: string, targetId: string) => {
            removeDependencyOnServer({sessionId, sourceId, targetId})
        },
        [removeDependencyOnServer],
    )

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
