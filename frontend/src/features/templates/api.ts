/**
 * The only place the generated Wails bindings for templates are touched. The
 * wire shape keeps params and system prompts as maps keyed by name, so this
 * file maps them to the ordered lists the frontend Template type uses. Under
 * the plain vite dev server there is no Go side and templates live in this
 * module's memory on top of src/lib/mock-templates.ts.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {PARAM_TYPES, ParamType, TASK_LEVELS, TaskLevel} from '@/shared/lib/enums'
import {MOCK_TEMPLATES} from '@/features/templates/mock-templates'
import type {Template, TemplateDraft} from '@/features/templates/types'
import {output_itf} from '@wailsjs/go/models'
import {
    RemoveTemplate,
    Template as FetchTemplate,
    Templates as FetchTemplates,
    UpsertTemplate,
} from '@wailsjs/go/wails_api/API'

const ROUNDTRIP_MS = 400

let templates: Template[] = structuredClone(MOCK_TEMPLATES)

async function roundtrip() {
    await new Promise((resolve) => setTimeout(resolve, ROUNDTRIP_MS))
}

function taskLevelOf(value: string): TaskLevel {
    return TASK_LEVELS.find((level) => level === value) ?? TaskLevel.Daily
}

function byKey([left]: [string, unknown], [right]: [string, unknown]) {
    return left.localeCompare(right)
}

function toTemplate(info: output_itf.TemplateInfo): Template {
    return {
        id: info.id,
        name: info.name,
        role: info.role,
        taskLevel: taskLevelOf(info.task_level),
        retryable: info.retryable,
        params: Object.entries(info.params ?? {})
            .sort(byKey)
            .map(([key, param]) => ({
                key,
                label: param?.description ?? '',
                type: PARAM_TYPES.find((type) => type === param?.type) ?? ParamType.Text,
                required: param?.required ?? false,
                default: param?.default || undefined,
                options: param?.options?.length ? param.options : undefined,
            })),
        systemPrompts: Object.entries(info.system_prompts ?? {})
            .sort(byKey)
            .map(([key, value]) => ({key, value})),
    }
}

function toInfo(draft: TemplateDraft): output_itf.TemplateInfo {
    return new output_itf.TemplateInfo({
        id: draft.id ?? '',
        name: draft.name,
        role: draft.role,
        task_level: draft.taskLevel,
        retryable: draft.retryable,
        params: Object.fromEntries(
            draft.params.map((param) => [
                param.key,
                {
                    description: param.label,
                    required: param.required,
                    type: param.type,
                    default: param.default ?? '',
                    options: param.options ?? [],
                },
            ]),
        ),
        system_prompts: Object.fromEntries(
            draft.systemPrompts.map((prompt) => [prompt.key, prompt.value]),
        ),
    })
}

export async function listTemplates(): Promise<Template[]> {
    if (!hasWailsRuntime()) return structuredClone(templates)

    const infos = await bridge(FetchTemplates)
    return infos.map(toTemplate)
}

export async function upsertTemplate(draft: TemplateDraft): Promise<Template> {
    if (!draft.name.trim()) throw new Error('A template needs a name before it can be saved.')

    if (hasWailsRuntime()) {
        const id = await bridge(() => UpsertTemplate(toInfo(draft)))
        return toTemplate(await bridge(() => FetchTemplate(id)))
    }

    await roundtrip()

    const next: Template = {...draft, id: draft.id ?? crypto.randomUUID()}
    templates = templates.some((template) => template.id === next.id)
        ? templates.map((template) => (template.id === next.id ? next : template))
        : [...templates, next]

    return structuredClone(next)
}

export async function removeTemplate(templateId: string): Promise<void> {
    if (hasWailsRuntime()) {
        await bridge(() => RemoveTemplate(templateId))
        return
    }

    await roundtrip()
    templates = templates.filter((template) => template.id !== templateId)
}
