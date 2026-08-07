import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/sessions/api'
import * as graph from '@/features/sessions/graph'
import {TaskState} from '@/shared/lib/enums'
import type {ParamValue} from '@/features/templates/types'
import type {Point, Session, SessionDraft, Task, TaskDraft} from '@/features/sessions/types'

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
    action: string,
    mutationFn: (args: TArgs) => Promise<unknown>,
    optimistic: (sessions: Session[], args: TArgs) => Session[],
) {
    const queryClient = useQueryClient()

    return useMutation({
        meta: {action},
        mutationFn,
        onMutate: async (args: TArgs) => {
            await queryClient.cancelQueries({queryKey: SESSIONS_KEY})
            const previous = queryClient.getQueryData<Session[]>(SESSIONS_KEY) ?? []
            queryClient.setQueryData<Session[]>(SESSIONS_KEY, optimistic(previous, args))
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
        meta: {action: 'Could not load your sessions'},
        refetchInterval: (query) =>
            query.state.data?.some(graph.hasActiveTask) ? RUN_POLL_MS : false,
        refetchIntervalInBackground: true,
    })

    const create = useSessionMutation(
        'Could not create the session',
        (args: {sessionId: string; draft: SessionDraft}) =>
            api.createSession(args.sessionId, args.draft),
        (sessions, {sessionId, draft}) => [
            {...graph.createSession(draft), id: sessionId},
            ...sessions,
        ],
    )

    const clone = useSessionMutation(
        'Could not duplicate the session',
        (args: {sourceId: string; sessionId: string}) =>
            api.cloneSession(args.sourceId, args.sessionId),
        (sessions, {sourceId, sessionId}) => {
            const source = graph.findSession(sessions, sourceId)
            if (!source) return sessions

            return [{...graph.duplicateSession(source), id: sessionId}, ...sessions]
        },
    )

    const rename = useSessionMutation(
        'Could not rename the session',
        (args: {sessionId: string; name: string}) =>
            api.updateSession(args.sessionId, {name: args.name}),
        (sessions, {sessionId, name}) =>
            editDraft(sessions, sessionId, (session) => ({...session, name})),
    )

    const setLocations = useSessionMutation(
        'Could not save the session directories',
        (args: {sessionId: string; workingDir: string; contextDir: string}) =>
            api.updateSession(args.sessionId, {
                workingDir: args.workingDir,
                contextDir: args.contextDir,
            }),
        (sessions, {sessionId, workingDir, contextDir}) =>
            editDraft(sessions, sessionId, (session) => ({...session, workingDir, contextDir})),
    )

    const finalize = useSessionMutation(
        'Could not finalize the session',
        (args: {sessionId: string}) => api.updateSession(args.sessionId, {finalized: true}),
        (sessions, {sessionId}) =>
            editSession(sessions, sessionId, (session) => ({...session, finalized: true})),
    )

    const start = useSessionMutation(
        'Could not start the run',
        (args: {sessionId: string}) => api.updateSession(args.sessionId, {started: true}),
        (sessions, {sessionId}) =>
            editSession(sessions, sessionId, (session) => ({...session, started: true})),
    )

    const cancel = useSessionMutation(
        'Could not cancel the run',
        (args: {sessionId: string}) => api.cancelSession(args.sessionId),
        (sessions, {sessionId}) => editSession(sessions, sessionId, graph.cancelRun),
    )

    const remove = useSessionMutation(
        'Could not delete the session',
        (args: {sessionId: string}) => api.deleteSession(args.sessionId),
        (sessions, {sessionId}) => sessions.filter((session) => session.id !== sessionId),
    )

    const createTask = useSessionMutation(
        'Could not add the node',
        (args: {sessionId: string; taskId: string; draft: TaskDraft; position: Point}) =>
            api.createTask(args.sessionId, args.taskId, args.draft, args.position),
        (sessions, {sessionId, taskId, draft, position}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withTask(session, {...graph.createTask(draft, position), id: taskId}),
            ),
    )

    const updateTask = useSessionMutation(
        'Could not save the node',
        (args: {sessionId: string; taskId: string; patch: Partial<Task>}) =>
            api.updateTask(args.sessionId, args.taskId, args.patch),
        (sessions, {sessionId, taskId, patch}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withTaskPatch(session, taskId, patch),
            ),
    )

    const saveInputs = useSessionMutation(
        'Could not save the inputs',
        (args: {sessionId: string; taskId: string; values: Record<string, ParamValue>}) =>
            api.setTaskInputs(args.sessionId, args.taskId, args.values),
        (sessions, {sessionId, taskId, values}) =>
            editSession(sessions, sessionId, (session) =>
                graph.withTaskPatch(session, taskId, {
                    values: {...graph.findTask(session, taskId)?.values, ...values},
                }),
            ),
    )

    const answerAcceptance = useSessionMutation(
        'Could not record your decision',
        (args: {sessionId: string; taskId: string; accepted: boolean}) =>
            api.answerTaskAcceptance(args.sessionId, args.taskId, args.accepted),
        (sessions, {sessionId, taskId, accepted}) =>
            editSession(sessions, sessionId, (session) =>
                graph.withTaskPatch(session, taskId, {
                    state: accepted ? TaskState.Done : TaskState.Failed,
                }),
            ),
    )

    const deleteTask = useSessionMutation(
        'Could not delete the node',
        (args: {sessionId: string; taskId: string}) => api.deleteTask(args.sessionId, args.taskId),
        (sessions, {sessionId, taskId}) =>
            editDraft(sessions, sessionId, (session) => graph.withoutTask(session, taskId)),
    )

    const connect = useSessionMutation(
        'Could not link the nodes',
        (args: {sessionId: string; sourceId: string; targetId: string}) =>
            api.addDependency(args.sessionId, args.sourceId, args.targetId),
        (sessions, {sessionId, sourceId, targetId}) =>
            editDraft(sessions, sessionId, (session) =>
                graph.withDependency(session, sourceId, targetId),
            ),
    )

    const disconnect = useSessionMutation(
        'Could not unlink the nodes',
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
        setSessionLocations: setLocations.mutate,
        finalizeSession: finalize.mutate,
        startSession: start.mutate,
        startingSession: start.isPending,
        cancelSession: cancel.mutate,
        cancellingSession: cancel.isPending,
        deleteSession: remove.mutate,
        createTask: createTask.mutate,
        updateTask: updateTask.mutate,
        saveTaskInputs: saveInputs.mutate,
        savingTaskInputs: saveInputs.isPending,
        answerTaskAcceptance: answerAcceptance.mutate,
        answeringTaskAcceptance: answerAcceptance.isPending,
        deleteTask: deleteTask.mutate,
        connectTasks: connect.mutate,
        disconnectTasks: disconnect.mutate,
    }
}
