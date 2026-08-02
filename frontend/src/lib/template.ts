import type {
    FieldValue,
    ParamType,
    ParamValue,
    TaskLevel,
    Template,
    TemplateDraft,
    TemplateParam,
} from '@/types/template'

export const TASK_LEVELS: TaskLevel[] = [
    'lightweight_task',
    'daily_task',
    'heavy_task',
    'maximum_effort_task',
]

export const TASK_LEVEL_LABELS: Record<TaskLevel, string> = {
    lightweight_task: 'Lightweight',
    daily_task: 'Daily',
    heavy_task: 'Heavy',
    maximum_effort_task: 'Maximum effort',
}

export const TASK_LEVEL_HINTS: Record<TaskLevel, string> = {
    lightweight_task: 'A quick edit the agent should finish in one pass.',
    daily_task: 'Ordinary work. The default for most nodes.',
    heavy_task: 'Multi-file work worth a slower, more careful agent.',
    maximum_effort_task: 'Give the agent room to explore before it commits.',
}

export const PARAM_TYPES: ParamType[] = ['text', 'textarea', 'number', 'boolean', 'select']

export const PARAM_TYPE_LABELS: Record<ParamType, string> = {
    text: 'Text',
    textarea: 'Long text',
    number: 'Number',
    boolean: 'Toggle',
    select: 'Choice',
}

export function emptyParam(): TemplateParam {
    return {key: '', label: '', type: 'text', required: false}
}

export function emptyTemplate(): TemplateDraft {
    return {
        name: '',
        role: '',
        taskLevel: 'daily_task',
        retryable: true,
        params: [emptyParam()],
        systemPrompts: [{key: 'base', value: ''}],
    }
}

export function paramSignature(template: Template) {
    return template.params.map((param) => (param.required ? `${param.key}*` : param.key)).join(' · ')
}

function defaultOf(param: TemplateParam): FieldValue {
    if (param.type === 'boolean') return param.default === 'true'
    if (param.type === 'select' && !param.options?.includes(param.default ?? '')) return ''
    return param.default ?? ''
}

export function defaultFieldValues(template: Template): Record<string, FieldValue> {
    return Object.fromEntries(template.params.map((param) => [param.key, defaultOf(param)]))
}

export function toFieldValues(
    template: Template,
    values: Record<string, ParamValue> = {},
): Record<string, FieldValue> {
    return Object.fromEntries(
        template.params.map((param) => {
            const value = values[param.key]
            if (param.type === 'boolean')
                return [param.key, value === undefined ? param.default === 'true' : value === true]

            return [param.key, value === undefined ? (param.default ?? '') : String(value)]
        }),
    )
}

export function toParamValues(
    template: Template,
    values: Record<string, FieldValue>,
): Record<string, ParamValue> {
    return Object.fromEntries(
        template.params.map((param) => {
            const value = values[param.key]
            if (param.type === 'boolean') return [param.key, value === true]
            if (param.type === 'number') return [param.key, value === '' ? 0 : Number(value)]
            return [param.key, String(value ?? '')]
        }),
    )
}

export function missingRequired(template: Template, values: Record<string, FieldValue>) {
    return template.params.filter(
        (param) =>
            param.required && param.type !== 'boolean' && String(values[param.key] ?? '') === '',
    )
}

export function templateIssues(draft: TemplateDraft) {
    const issues: string[] = []
    const keys = draft.params.map((param) => param.key.trim()).filter(Boolean)

    if (!draft.name.trim()) issues.push('Give the template a name.')
    if (draft.params.some((param) => !param.key.trim()))
        issues.push('Every input needs a key the agent can read.')
    if (new Set(keys).size !== keys.length) issues.push('Two inputs share the same key.')
    if (draft.params.some((param) => param.type === 'select' && !param.options?.length))
        issues.push('A choice input needs at least one option.')
    if (draft.systemPrompts.some((prompt) => !prompt.key.trim()))
        issues.push('Every prompt needs a key.')

    return issues
}
