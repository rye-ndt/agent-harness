import {useState} from 'react'
import {Pencil, Plus, Trash2} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {TASK_LEVEL_LABELS} from '@/shared/lib/enums'
import {paramSignature} from '@/features/templates/template'
import type {Template} from '@/features/templates/types'

export function TemplateList({
    templates,
    loading,
    onPick,
    onEdit,
    onRemove,
    onCreate,
}: {
    templates: Template[]
    loading: boolean
    onPick: (template: Template) => void
    onEdit: (template: Template) => void
    onRemove: (templateId: string) => void
    onCreate: () => void
}) {
    if (loading)
        return <p className="px-4 py-3 text-base text-muted-foreground">Loading templates…</p>

    if (templates.length === 0)
        return (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-base text-muted-foreground">
                    No templates yet. A template describes one kind of work — the agent's role, the
                    inputs it needs, and how hard it should try.
                </p>
                <Button variant="outline" size="sm" onClick={onCreate}>
                    <Plus />
                    New template
                </Button>
            </div>
        )

    return (
        <div className="flex flex-col gap-2 p-4">
            {templates.map((template) => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    onPick={onPick}
                    onEdit={onEdit}
                    onRemove={onRemove}
                />
            ))}
        </div>
    )
}

function TemplateCard({
    template,
    onPick,
    onEdit,
    onRemove,
}: {
    template: Template
    onPick: (template: Template) => void
    onEdit: (template: Template) => void
    onRemove: (templateId: string) => void
}) {
    const [confirming, setConfirming] = useState(false)

    const pick = () => onPick(template)
    const edit = () => onEdit(template)
    const askRemove = () => setConfirming(true)
    const cancelRemove = () => setConfirming(false)
    const remove = () => onRemove(template.id)

    if (confirming)
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    Delete <span className="font-medium text-foreground">{template.name}</span>?
                    Nodes built from it keep their prompt.
                </p>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={cancelRemove}>
                    Cancel
                </Button>
                <Button
                    autoFocus
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={remove}
                >
                    Delete
                </Button>
            </div>
        )

    return (
        <div className="group relative rounded-lg border border-border transition-colors hover:border-foreground/25 hover:bg-muted/40">
            <button
                type="button"
                onClick={pick}
                className="flex w-full flex-col gap-2 rounded-lg p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-live"
            >
                <span className="flex items-center gap-2 pr-16">
                    <span className="truncate text-base font-medium">{template.name}</span>
                    <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-state-idle-tint px-2 text-xs font-medium text-muted-foreground">
                        {TASK_LEVEL_LABELS[template.taskLevel]}
                    </span>
                    {!template.retryable && (
                        <span className="shrink-0 text-xs text-muted-foreground">no retry</span>
                    )}
                </span>

                <span className="line-clamp-2 text-sm text-muted-foreground">
                    {template.role || 'No role set.'}
                </span>

                <span className="truncate font-mono text-sm text-muted-foreground">
                    {paramSignature(template) || 'no inputs'}
                </span>
            </button>

            <span className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${template.name}`}
                    onClick={edit}
                >
                    <Pencil />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${template.name}`}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={askRemove}
                >
                    <Trash2 />
                </Button>
            </span>
        </div>
    )
}
