import type {ReactNode} from 'react'
import {Plus} from 'lucide-react'

import {Field} from '@/components/common/field'
import {ParamEditor} from '@/components/templates/param-editor'
import {PromptEditor} from '@/components/templates/prompt-editor'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import {emptyParam, TASK_LEVEL_HINTS, TASK_LEVEL_LABELS, TASK_LEVELS} from '@/lib/template'
import type {TaskLevel, TemplateDraft} from '@/types/template'

function replaceAt<T>(list: T[], index: number, fields: Partial<T>) {
    return list.map((item, at) => (at === index ? {...item, ...fields} : item))
}

function removeAt<T>(list: T[], index: number) {
    return list.filter((_, at) => at !== index)
}

export function TemplateForm({
    draft,
    onChange,
}: {
    draft: TemplateDraft
    onChange: (draft: TemplateDraft) => void
}) {
    const patch = (fields: Partial<TemplateDraft>) => onChange({...draft, ...fields})

    return (
        <div className="flex flex-col gap-6 p-4">
            <Field htmlFor="template-name" label="Name">
                <Input
                    id="template-name"
                    value={draft.name}
                    placeholder="Code reviewer"
                    onChange={(event) => patch({name: event.target.value})}
                />
            </Field>

            <Field
                htmlFor="template-role"
                label="Role"
                hint="Shows on every node built from this template."
            >
                <Textarea
                    id="template-role"
                    rows={2}
                    value={draft.role}
                    placeholder="Reads a diff and reports the defects it can prove."
                    onChange={(event) => patch({role: event.target.value})}
                />
            </Field>

            <div className="flex flex-col gap-2">
                <div className="flex items-end gap-3">
                    <Field htmlFor="template-level" label="Effort" className="min-w-0 flex-1">
                        <Select
                            value={draft.taskLevel}
                            onValueChange={(value) => patch({taskLevel: value as TaskLevel})}
                        >
                            <SelectTrigger id="template-level">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TASK_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                        {TASK_LEVEL_LABELS[level]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <label
                        htmlFor="template-retryable"
                        className="flex h-9 shrink-0 items-center gap-3 rounded-lg border border-border px-3"
                    >
                        <span className="text-base font-medium">Retry on failure</span>
                        <Switch
                            id="template-retryable"
                            checked={draft.retryable}
                            onCheckedChange={(retryable) => patch({retryable})}
                        />
                    </label>
                </div>

                <p className="text-sm text-muted-foreground">
                    {TASK_LEVEL_HINTS[draft.taskLevel]}
                </p>
            </div>

            <Section
                title="Inputs"
                hint="What a node must supply before this template can run."
                onAdd={() => patch({params: [...draft.params, emptyParam()]})}
                addLabel="Add input"
            >
                {draft.params.map((param, index) => (
                    <ParamEditor
                        key={index}
                        param={param}
                        onChange={(fields) =>
                            patch({params: replaceAt(draft.params, index, fields)})
                        }
                        onRemove={() => patch({params: removeAt(draft.params, index)})}
                    />
                ))}
            </Section>

            <Section
                title="Prompts"
                onAdd={() => patch({systemPrompts: [...draft.systemPrompts, {key: '', value: ''}]})}
                addLabel="Add prompt"
            >
                {draft.systemPrompts.map((prompt, index) => (
                    <PromptEditor
                        key={index}
                        prompt={prompt}
                        onChange={(fields) =>
                            patch({systemPrompts: replaceAt(draft.systemPrompts, index, fields)})
                        }
                        onRemove={() => patch({systemPrompts: removeAt(draft.systemPrompts, index)})}
                    />
                ))}
            </Section>
        </div>
    )
}

function Section({
    title,
    hint,
    addLabel,
    onAdd,
    children,
}: {
    title: string
    hint?: string
    addLabel: string
    onAdd: () => void
    children: ReactNode
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="micro-label">{title}</span>
                    {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
                    <Plus />
                    {addLabel}
                </Button>
            </div>
            {children}
        </section>
    )
}
