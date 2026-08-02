/**
 * Stand-in for the Go AgentTemplateManager port, which has no Wails binding
 * yet. Templates live in this module's memory. When the real bindings land,
 * this is the only file that changes.
 */

import {MOCK_TEMPLATES} from '@/lib/mock-templates'
import type {Template, TemplateDraft} from '@/types/template'

const ROUNDTRIP_MS = 400

let templates: Template[] = structuredClone(MOCK_TEMPLATES)

async function roundtrip() {
    await new Promise((resolve) => setTimeout(resolve, ROUNDTRIP_MS))
}

export async function listTemplates(): Promise<Template[]> {
    return structuredClone(templates)
}

export async function upsertTemplate(draft: TemplateDraft): Promise<Template> {
    if (!draft.name.trim()) throw new Error('A template needs a name before it can be saved.')
    await roundtrip()

    const next: Template = {...draft, id: draft.id ?? crypto.randomUUID()}
    templates = templates.some((template) => template.id === next.id)
        ? templates.map((template) => (template.id === next.id ? next : template))
        : [...templates, next]

    return structuredClone(next)
}

export async function removeTemplate(templateId: string): Promise<void> {
    await roundtrip()
    templates = templates.filter((template) => template.id !== templateId)
}
