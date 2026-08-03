import type {TaskLevel, ThinkingLevel} from '@/lib/enums'

export type MCPServer = {
    id: string
    name: string
    url: string
    authorized: boolean
    authorizedAt?: string
}

export type AgentDefault = {
    taskLevel: TaskLevel
    model: string
    modelLabel: string
    thinkingLevel: ThinkingLevel
}

export type ModelOption = {
    model: string
    label: string
    /** Which harness runs this model — the DTO form of enums.ModelName.HarnessTool(). */
    harness: string
}

export type AgentDefaultOptions = {
    taskLevels: TaskLevel[]
    models: ModelOption[]
    thinkingLevels: ThinkingLevel[]
}
