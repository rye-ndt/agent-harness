import type {ParamValue} from '@/types/template'

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

export type FileChangeType = 'created' | 'modified' | 'deleted' | 'renamed'

export type FileChange = {
    path: string
    oldPath: string
    changeType: FileChangeType
    additions: number
    deletions: number
    unifiedDiff: string
}

export type HandoverDoc = {
    task: string
    outcome: string
    blockers: Record<string, string>
    approvedDecisions: Record<string, string>
    rejectedDecisions: Record<string, string>
    currentBehaviors: Record<string, string>
    changedBehaviors: Record<string, string>
    mustAvoid: Record<string, string>
    nuances: Record<string, string>
    knownGaps: Record<string, string>
}

export type TaskReport = {
    status: TaskState
    fileChanges: FileChange[]
    handoverDocs: HandoverDoc[]
}

export type Run = {
    startedAt?: string
    finishedAt?: string
    retryCount?: number
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
    templateId?: string
    values?: Record<string, ParamValue>
    run?: Run
    report?: TaskReport
}

export type TaskDraft = {
    title: string
    prompt: string
    templateId: string
    values: Record<string, ParamValue>
}

export type Session = {
    id: string
    name: string
    createdAt: string
    finalized: boolean
    tasks: Task[]
}
