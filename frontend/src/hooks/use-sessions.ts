import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/api/sessions'
import * as graph from '@/lib/session'
import type {Point, Session, Task, TaskDraft} from '@/types/session'

const SESSIONS_KEY = ['sessions']

const RUN_POLL_MS = 900

type SessionEdit = (session: Session) => Session

function editSession(sessions: Session[], sessionId: string, edit: SessionEdit) {
    return sessions.map((session) => (session.id === sessionId ? edit(session) : session))
}

function editDraft(sessions: Session[], sessionId: string, edit: SessionEdit) {
    return sessions.map((session) =>
        session.id === sessionId && !session.finalized ? edit(session) : session,
    )
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

/** Sessions are server state: every write goes out optimistically and is reconciled by a refetch. */
export function useSessions() {
    const {data} = useQuery({
        queryKey: SESSIONS_KEY,
        queryFn: api.listSessions,
        refetchInterval: (query) =>
            query.state.data?.some(graph.hasActiveTask) ? RUN_POLL_MS : false,
    })

    const create = useSessionMutation(
        (args: {sessionId: string}) => api.createSession(args.sessionId),
        (sessions, {sessionId}) => [
            {...graph.createSession(sessions.length), id: sessionId},
            ...sessions,
        ],
    )

    const clone = useSessionMutation(
        (args: {sourceId: string; sessionId: string}) =>
            api.cloneSession(args.sourceId, args.sessionId),
        (sessions, {sourceId, sessionId}) => {
            const source = graph.findSession(sessions, sourceId)
            if (!source) return sessions

            return [{...graph.duplicateSession(source), id: sessionId}, ...sessions]
        },
    )

    const rename = useSessionMutation(
        (args: {sessionId: string; name: string}) =>
            api.updateSession(args.sessionId, {name: args.name}),
        (sessions, {sessionId, name}) =>
            editDraft(sessions, sessionId, (session) => ({...session, name})),
    )

    const setWorkingDir = useSessionMutation(
        (args: {sessionId: string; workingDir: string}) =>
            api.updateSession(args.sessionId, {workingDir: args.workingDir}),
        (sessions, {sessionId, workingDir}) =>
            editDraft(sessions, sessionId, (session) => ({...session, workingDir})),
    )

    const finalize = useSessionMutation(
        (args: {sessionId: string}) => api.updateSession(args.sessionId, {finalized: true}),
        (sessions, {sessionId}) =>
            editSession(sessions, sessionId, (session) => ({...session, finalized: true})),
    )

    const remove = useSessionMutation(
        (args: {sessionId: string}) => api.deleteSession(args.sessionId),
        (sessions, {sessionId}) => sessions.filter((session) => session.id !== sessionId),
    )

    const createTask = useSessionMutation(
        (args: {sessionId: string; taskId: string; draft: TaskDraft; position: Point}) =>
            api.createTask(args.sessionId, args.taskId, args.draft, args.position),
        (sessions, {sessionId, taskId, draft, position}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withTask(session, {...graph.createTask(draft, position), id: taskId}),
            ),
    )

    const updateTask = useSessionMutation(
        (args: {sessionId: string; taskId: string; patch: Partial<Task>}) =>
            api.updateTask(args.sessionId, args.taskId, args.patch),
        (sessions, {sessionId, taskId, patch}) =>
            editDraft(sessions, sessionId, (session) => graph.withTaskPatch(session, taskId, patch)),
    )

    const deleteTask = useSessionMutation(
        (args: {sessionId: string; taskId: string}) => api.deleteTask(args.sessionId, args.taskId),
        (sessions, {sessionId, taskId}) =>
            editDraft(sessions, sessionId, (session) => graph.withoutTask(session, taskId)),
    )

    const connect = useSessionMutation(
        (args: {sessionId: string; sourceId: string; targetId: string}) =>
            api.addDependency(args.sessionId, args.sourceId, args.targetId),
        (sessions, {sessionId, sourceId, targetId}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withDependency(session, sourceId, targetId),
            ),
    )

    const disconnect = useSessionMutation(
        (args: {sessionId: string; sourceId: string; targetId: string}) =>
            api.removeDependency(args.sessionId, args.sourceId, args.targetId),
        (sessions, {sessionId, sourceId, targetId}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withoutDependency(session, sourceId, targetId),
            ),
    )

    return {
        sessions: data ?? [],
        createSession: create.mutate,
        cloneSession: clone.mutate,
        renameSession: rename.mutate,
        setSessionWorkingDir: setWorkingDir.mutate,
        finalizeSession: finalize.mutate,
        deleteSession: remove.mutate,
        createTask: createTask.mutate,
        updateTask: updateTask.mutate,
        deleteTask: deleteTask.mutate,
        connectTasks: connect.mutate,
        disconnectTasks: disconnect.mutate,
    }
}
