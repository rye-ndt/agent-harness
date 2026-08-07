import {SessionStatus, TaskState} from '@/shared/lib/enums'
import type {Point, Session, SessionDraft, Task, TaskDraft} from '@/features/sessions/types'

const SETTLED_STATES = new Set<TaskState>([
    TaskState.Running,
    TaskState.AwaitingAccept,
    TaskState.Done,
    TaskState.Failed,
    TaskState.Cancelled,
])

const FINISHED_STATES = new Set<TaskState>([TaskState.Done, TaskState.Failed, TaskState.Cancelled])

const KEPT_ON_CANCEL = new Set<TaskState>([TaskState.Done, TaskState.Failed])

const WAITING_STATES = new Set<TaskState>([TaskState.Idle, TaskState.Queued, TaskState.Blocked])

const NODE_STAGGER = 40

export function isSettled(state: TaskState) {
    return SETTLED_STATES.has(state)
}

export function isFinished(state: TaskState) {
    return FINISHED_STATES.has(state)
}

export function createTask(draft: TaskDraft, position: Point): Task {
    return {
        id: crypto.randomUUID(),
        title: draft.title,
        prompt: draft.prompt,
        state: TaskState.Idle,
        position,
        dependsOn: [],
        templateId: draft.templateId,
        values: draft.values,
    }
}

export function createSession(draft: SessionDraft): Session {
    return {
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        createdAt: new Date().toISOString(),
        finalized: false,
        started: false,
        cancelled: false,
        workingDir: draft.workingDir.trim(),
        contextDir: draft.contextDir.trim(),
        tasks: [],
    }
}

/** Deep copy: new session id, new task ids, remapped edges, run history cleared. */
export function duplicateSession(session: Session): Session {
    const idMap = new Map(session.tasks.map((task) => [task.id, crypto.randomUUID()]))

    return {
        id: crypto.randomUUID(),
        name: `${session.name} copy`,
        createdAt: new Date().toISOString(),
        finalized: false,
        started: false,
        cancelled: false,
        workingDir: session.workingDir,
        contextDir: session.contextDir,
        tasks: session.tasks.map((task) => ({
            id: idMap.get(task.id)!,
            title: task.title,
            prompt: task.prompt,
            state: TaskState.Idle,
            position: {...task.position},
            dependsOn: task.dependsOn.map((id) => idMap.get(id)!).filter(Boolean),
            templateId: task.templateId,
            values: task.values ? {...task.values} : undefined,
        })),
    }
}

/** Cancel is terminal: finished nodes keep their reports, everything else loses its work. */
export function cancelRun(session: Session): Session {
    const now = new Date().toISOString()

    return {
        ...session,
        cancelled: true,
        tasks: session.tasks.map((task) => {
            if (KEPT_ON_CANCEL.has(task.state)) return task

            return {
                ...task,
                state: TaskState.Cancelled,
                run: task.run ? {...task.run, finishedAt: now, context: undefined} : undefined,
                report: undefined,
            }
        }),
    }
}

export function isCancellable(session: Session): boolean {
    if (!session.started || session.cancelled) return false
    return session.tasks.some(
        (task) => !KEPT_ON_CANCEL.has(task.state) && task.state !== TaskState.Cancelled,
    )
}

export function findSession(sessions: Session[], sessionId: string | null) {
    if (!sessionId) return undefined
    return sessions.find((session) => session.id === sessionId)
}

export function findTask(session: Session, taskId: string | null) {
    if (!taskId) return undefined
    return session.tasks.find((task) => task.id === taskId)
}

export function withTask(session: Session, task: Task): Session {
    return {...session, tasks: [...session.tasks, task]}
}

export function withTaskPatch(session: Session, taskId: string, patch: Partial<Task>): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            task.id === taskId ? {...task, ...patch, id: taskId} : task,
        ),
    }
}

export function withoutTask(session: Session, taskId: string): Session {
    return {
        ...session,
        tasks: session.tasks
            .filter((task) => task.id !== taskId)
            .map((task) => ({...task, dependsOn: task.dependsOn.filter((id) => id !== taskId)})),
    }
}

export function withDependency(session: Session, sourceId: string, targetId: string): Session {
    if (createsCycle(session.tasks, sourceId, targetId)) return session

    return {
        ...session,
        tasks: session.tasks.map((task) => {
            const needsEdge = task.id === targetId && !task.dependsOn.includes(sourceId)
            return needsEdge ? {...task, dependsOn: [...task.dependsOn, sourceId]} : task
        }),
    }
}

export function withoutDependency(session: Session, sourceId: string, targetId: string): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            task.id === targetId
                ? {...task, dependsOn: task.dependsOn.filter((id) => id !== sourceId)}
                : task,
        ),
    }
}

export function freePosition(session: Session, wanted: Point): Point {
    const taken = (point: Point) =>
        session.tasks.some((task) => task.position.x === point.x && task.position.y === point.y)

    let position = wanted
    while (taken(position)) position = {x: position.x + NODE_STAGGER, y: position.y + NODE_STAGGER}

    return position
}

export function sessionStatus(session: Session): SessionStatus {
    if (session.tasks.length === 0) return SessionStatus.Empty
    if (session.cancelled) return SessionStatus.Cancelled
    if (!session.finalized) return SessionStatus.Draft
    if (!session.started) return SessionStatus.Ready
    if (session.tasks.some((task) => task.state === TaskState.Failed)) return SessionStatus.Failed
    if (session.tasks.every((task) => task.state === TaskState.Done)) return SessionStatus.Done
    return SessionStatus.Running
}

export function hasRunningTask(session: Session) {
    return session.tasks.some((task) => task.state === TaskState.Running)
}

export function hasActiveTask(session: Session) {
    return session.tasks.some(
        (task) =>
            task.state === TaskState.Running ||
            task.state === TaskState.Queued ||
            task.state === TaskState.AwaitingAccept,
    )
}

export function sessionProgress(session: Session) {
    const done = session.tasks.filter((task) => task.state === TaskState.Done).length
    return {done, total: session.tasks.length}
}

/** Running the session releases the roots; every other task also waits on its upstream — the fan-in join. */
export function isRunnable(session: Session, task: Task) {
    const upstreamDone = task.dependsOn.every(
        (id) => findTask(session, id)?.state === TaskState.Done,
    )

    return session.started && WAITING_STATES.has(task.state) && upstreamDone
}

export function label(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) => {
            if (isSettled(task.state)) return task
            return {
                ...task,
                state: isRunnable(session, task) ? TaskState.Queued : TaskState.Blocked,
            }
        }),
    }
}

export function upstreamOf(session: Session, task: Task) {
    return task.dependsOn
        .map((id) => findTask(session, id))
        .filter((candidate): candidate is Task => Boolean(candidate))
}

export function downstreamOf(session: Session, task: Task) {
    return session.tasks.filter((other) => other.dependsOn.includes(task.id))
}

function reachable(adjacency: Map<string, string[]>, from: string) {
    const seen = new Set<string>()
    const stack = [...(adjacency.get(from) ?? [])]

    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        stack.push(...(adjacency.get(current) ?? []))
    }

    return seen
}

export function ancestorsOf(tasks: Task[], taskId: string) {
    return reachable(new Map(tasks.map((task) => [task.id, task.dependsOn])), taskId)
}

export function descendantsOf(tasks: Task[], taskId: string) {
    const adjacency = new Map<string, string[]>(tasks.map((task) => [task.id, []]))
    for (const task of tasks)
        for (const dependency of task.dependsOn) adjacency.get(dependency)?.push(task.id)

    return reachable(adjacency, taskId)
}

/** Depth-first reachability check, so connecting two tasks can never form a cycle. */
export function createsCycle(tasks: Task[], sourceId: string, targetId: string) {
    return sourceId === targetId || ancestorsOf(tasks, sourceId).has(targetId)
}

export function unlinkableFrom(tasks: Task[], sourceId: string) {
    const blocked = ancestorsOf(tasks, sourceId)
    blocked.add(sourceId)
    return blocked
}

export function unlinkableInto(tasks: Task[], targetId: string) {
    const blocked = descendantsOf(tasks, targetId)
    blocked.add(targetId)
    return blocked
}

/** Layer index per task: 0 for roots, otherwise one past its deepest upstream. */
export function taskLayers(session: Session) {
    const layers = new Map<string, number>()

    const depth = (task: Task, seen: Set<string>): number => {
        if (layers.has(task.id)) return layers.get(task.id)!
        if (seen.has(task.id)) return 0
        seen.add(task.id)

        const upstream = upstreamOf(session, task)
        const value =
            upstream.length === 0 ? 0 : Math.max(...upstream.map((t) => depth(t, seen))) + 1

        layers.set(task.id, value)
        return value
    }

    for (const task of session.tasks) depth(task, new Set())

    return layers
}
