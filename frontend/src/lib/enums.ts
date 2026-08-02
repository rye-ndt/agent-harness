export const TaskState = {
    Idle: 'idle',
    Blocked: 'blocked',
    Queued: 'queued',
    Running: 'running',
    AwaitingApproval: 'awaiting_approval',
    Done: 'done',
    Failed: 'failed',
} as const

export type TaskState = (typeof TaskState)[keyof typeof TaskState]

export const TASK_STATE_LABELS: Record<TaskState, string> = {
    [TaskState.Idle]: 'Idle',
    [TaskState.Blocked]: 'Blocked',
    [TaskState.Queued]: 'Ready',
    [TaskState.Running]: 'Running',
    [TaskState.AwaitingApproval]: 'Needs you',
    [TaskState.Done]: 'Done',
    [TaskState.Failed]: 'Failed',
}

export const SessionStatus = {
    Empty: 'empty',
    Draft: 'draft',
    Running: 'running',
    Done: 'done',
    Failed: 'failed',
} as const

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
    [SessionStatus.Empty]: 'Empty',
    [SessionStatus.Draft]: 'Draft',
    [SessionStatus.Running]: 'Running',
    [SessionStatus.Done]: 'Done',
    [SessionStatus.Failed]: 'Failed',
}

export const FileChangeType = {
    Created: 'created',
    Modified: 'modified',
    Deleted: 'deleted',
    Renamed: 'renamed',
} as const

export type FileChangeType = (typeof FileChangeType)[keyof typeof FileChangeType]

export const TaskLevel = {
    Lightweight: 'lightweight_task',
    Daily: 'daily_task',
    Heavy: 'heavy_task',
    MaximumEffort: 'maximum_effort_task',
} as const

export type TaskLevel = (typeof TaskLevel)[keyof typeof TaskLevel]

export const TASK_LEVELS: TaskLevel[] = [
    TaskLevel.Lightweight,
    TaskLevel.Daily,
    TaskLevel.Heavy,
    TaskLevel.MaximumEffort,
]

export const TASK_LEVEL_LABELS: Record<TaskLevel, string> = {
    [TaskLevel.Lightweight]: 'Lightweight',
    [TaskLevel.Daily]: 'Daily',
    [TaskLevel.Heavy]: 'Heavy',
    [TaskLevel.MaximumEffort]: 'Maximum effort',
}

export const TASK_LEVEL_HINTS: Record<TaskLevel, string> = {
    [TaskLevel.Lightweight]: 'A quick edit the agent should finish in one pass.',
    [TaskLevel.Daily]: 'Ordinary work. The default for most nodes.',
    [TaskLevel.Heavy]: 'Multi-file work worth a slower, more careful agent.',
    [TaskLevel.MaximumEffort]: 'Give the agent room to explore before it commits.',
}

export const ParamType = {
    Text: 'text',
    Textarea: 'textarea',
    Number: 'number',
    Boolean: 'boolean',
    Select: 'select',
} as const

export type ParamType = (typeof ParamType)[keyof typeof ParamType]

export const PARAM_TYPES: ParamType[] = [
    ParamType.Text,
    ParamType.Textarea,
    ParamType.Number,
    ParamType.Boolean,
    ParamType.Select,
]

export const PARAM_TYPE_LABELS: Record<ParamType, string> = {
    [ParamType.Text]: 'Text',
    [ParamType.Textarea]: 'Long text',
    [ParamType.Number]: 'Number',
    [ParamType.Boolean]: 'Toggle',
    [ParamType.Select]: 'Choice',
}
