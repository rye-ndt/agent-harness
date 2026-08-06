import {ParamType, TaskLevel} from '@/shared/lib/enums'
import type {
    FieldValue,
    ParamValue,
    Template,
    TemplateDraft,
    TemplateParam,
} from '@/features/templates/types'

export const NO_PROMPTS_ISSUE = 'A template needs at least one prompt.'

export function emptyParam(): TemplateParam {
    return {key: '', label: '', type: ParamType.Text, required: false}
}

export function emptyTemplate(): TemplateDraft {
    return {
        name: '',
        role: '',
        taskLevel: TaskLevel.Daily,
        retryable: true,
        manualAcceptRequired: false,
        params: [emptyParam()],
        systemPrompts: [{key: 'base', value: ''}],
    }
}

export function paramSignature(template: Template) {
    return template.params
        .map((param) => (param.required ? `${param.key}*` : param.key))
        .join(' · ')
}

function defaultOf(param: TemplateParam): FieldValue {
    if (param.type === ParamType.Boolean) return param.default === 'true'
    if (param.type === ParamType.Select && !param.options?.includes(param.default ?? '')) return ''
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
            if (param.type === ParamType.Boolean)
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
            if (param.type === ParamType.Boolean) return [param.key, value === true]
            if (param.type === ParamType.Number)
                return [param.key, value === '' ? 0 : Number(value)]
            return [param.key, String(value ?? '')]
        }),
    )
}

export function missingRequired(template: Template, values: Record<string, FieldValue>) {
    return template.params.filter((param) => {
        const answerable = param.required && param.type !== ParamType.Boolean
        return answerable && String(values[param.key] ?? '') === ''
    })
}

export function templateIssues(draft: TemplateDraft) {
    const issues: string[] = []
    const keys = draft.params.map((param) => param.key.trim()).filter(Boolean)

    if (!draft.name.trim()) issues.push('Give the template a name.')
    if (draft.params.some((param) => !param.key.trim()))
        issues.push('Every input needs a key the agent can read.')
    if (new Set(keys).size !== keys.length) issues.push('Two inputs share the same key.')
    if (draft.params.some((param) => param.type === ParamType.Select && !param.options?.length))
        issues.push('A choice input needs at least one option.')
    if (draft.systemPrompts.length === 0) issues.push(NO_PROMPTS_ISSUE)
    if (draft.systemPrompts.some((prompt) => !prompt.key.trim()))
        issues.push('Every prompt needs a key.')

    return issues
}

export function promptFromTemplate(template: Template) {
    return template.systemPrompts.map((prompt) => prompt.value).join('\n\n')
}
