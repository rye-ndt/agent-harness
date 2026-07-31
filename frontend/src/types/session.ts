export type TaskState =
    | 'idle'
    | 'blocked'
    | 'queued'
    | 'running'
    | 'awaiting_approval'
    | 'done'
    | 'failed'

export type SessionStatus = 'empty' | 'draft' | 'running' | 'done' | 'failed'

export type Point = {
    x: number
    y: number
}

export type ContextUsage = {
    used: number
    total: number
}

export type ApprovalOption = {
    id: string
    label: string
    description: string
}

export type Approval = {
    id: string
    question: string
    detail: string
    options: ApprovalOption[]
    multiSelect: boolean
}

export type Run = {
    startedAt?: string
    finishedAt?: string
    log: string[]
    context?: ContextUsage
}

export type Task = {
    id: string
    title: string
    prompt: string
    agent: string
    state: TaskState
    position: Point
    dependsOn: string[]
    run?: Run
    approval?: Approval
}

export type Session = {
    id: string
    name: string
    createdAt: string
    finalized: boolean
    tasks: Task[]
}
