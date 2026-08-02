import type {Point, Session, SessionStatus, Task, TaskDraft, TaskState} from '@/types/session'

export const TASK_STATES: TaskState[] = [
    'idle',
    'blocked',
    'queued',
    'running',
    'awaiting_approval',
    'done',
    'failed',
]

export const STATE_LABELS: Record<TaskState, string> = {
    idle: 'Not started',
    blocked: 'Waiting on upstream',
    queued: 'Ready to run',
    running: 'Running',
    awaiting_approval: 'Needs you',
    done: 'Done',
    failed: 'Failed',
}

export const STATE_SHORT_LABELS: Record<TaskState, string> = {
    idle: 'Idle',
    blocked: 'Blocked',
    queued: 'Ready',
    running: 'Running',
    awaiting_approval: 'Needs you',
    done: 'Done',
    failed: 'Failed',
}

export function createTask(draft: TaskDraft, position: Point): Task {
    return {
        id: crypto.randomUUID(),
        title: draft.title,
        prompt: draft.prompt,
        agent: 'claude_code',
        state: 'idle',
        position,
        dependsOn: [],
        templateId: draft.templateId,
        values: draft.values,
    }
}

export function createSession(index: number): Session {
    return {
        id: crypto.randomUUID(),
        name: `Session ${index + 1}`,
        createdAt: new Date().toISOString(),
        finalized: false,
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
        tasks: session.tasks.map((task) => ({
            id: idMap.get(task.id)!,
            title: task.title,
            prompt: task.prompt,
            agent: task.agent,
            state: 'idle',
            position: {...task.position},
            dependsOn: task.dependsOn.map((id) => idMap.get(id)!).filter(Boolean),
            templateId: task.templateId,
            values: task.values ? {...task.values} : undefined,
        })),
    }
}

export function findTask(session: Session, taskId: string | null) {
    if (!taskId) return undefined
    return session.tasks.find((task) => task.id === taskId)
}

export function sessionStatus(session: Session): SessionStatus {
    if (session.tasks.length === 0) return 'empty'
    if (!session.finalized) return 'draft'
    if (session.tasks.some((task) => task.state === 'failed')) return 'failed'
    if (session.tasks.every((task) => task.state === 'done')) return 'done'
    return 'running'
}

export function hasRunningTask(session: Session) {
    return session.tasks.some((task) => task.state === 'running')
}

export function sessionProgress(session: Session) {
    const done = session.tasks.filter((task) => task.state === 'done').length
    return {done, total: session.tasks.length}
}

/** Finalizing starts the run, so a task waits for that and for every upstream task — the fan-in join. */
export function isRunnable(session: Session, task: Task) {
    return (
        session.finalized &&
        (task.state === 'idle' || task.state === 'queued' || task.state === 'blocked') &&
        task.dependsOn.every((id) => findTask(session, id)?.state === 'done')
    )
}

export function upstreamOf(session: Session, task: Task) {
    return task.dependsOn
        .map((id) => findTask(session, id))
        .filter((t): t is Task => Boolean(t))
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
