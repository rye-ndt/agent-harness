import {useState} from 'react'
import {Pencil, Plus, Trash2} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {ConfirmDialog} from '@/shared/components/confirm-dialog'
import {TaskLevelTag} from '@/shared/components/task-level-tag'
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

    return (
        <div className="group relative rounded-xl border border-border bg-card transition-colors hover:border-foreground/25 hover:bg-muted/40">
            <button
                type="button"
                onClick={pick}
                className="flex w-full flex-col gap-2 rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="flex items-center gap-2 pr-16">
                    <span className="truncate text-base font-medium">{template.name}</span>
                    <TaskLevelTag taskLevel={template.taskLevel} />
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

            {confirming && (
                <ConfirmDialog
                    title={`Delete “${template.name}”?`}
                    description="Nodes already built from it keep their prompt. This cannot be undone."
                    confirmLabel="Delete template"
                    destructive
                    onConfirm={remove}
                    onClose={cancelRemove}
                />
            )}
        </div>
    )
}
