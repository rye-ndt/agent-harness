import type {ParamType, TaskLevel} from '@/shared/lib/enums'

export type TemplateParam = {
    key: string
    label: string
    type: ParamType
    required: boolean
    default?: string
    options?: string[]
}

export type SystemPrompt = {
    key: string
    value: string
}

export type Template = {
    id: string
    name: string
    role: string
    taskLevel: TaskLevel
    retryable: boolean
    manualAcceptRequired: boolean
    params: TemplateParam[]
    systemPrompts: SystemPrompt[]
}

export type TemplateDraft = Omit<Template, 'id'> & {id?: string}

export type FieldValue = string | boolean

export type ParamValue = string | number | boolean
