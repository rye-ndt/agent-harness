import {useMemo, useState} from 'react'
import {Lock, Trash2} from 'lucide-react'

import {DialogShell} from '@/shared/components/dialog-shell'
import {InheritedAgent} from '@/features/sessions/components/nodes/inherited-agent'
import {MissingInputs} from '@/features/sessions/components/nodes/missing-inputs'
import {NodeForm} from '@/features/sessions/components/nodes/node-form'
import {Button} from '@/shared/ui/button'
import {useTemplates} from '@/features/templates/use-templates'
import {missingRequired, toFieldValues, toParamValues} from '@/features/templates/template'
import type {Task} from '@/features/sessions/types'
import type {FieldValue} from '@/features/templates/types'

export function EditNodeDialog({
    task,
    onSave,
    onDelete,
    onClose,
}: {
    task: Task
    onSave: (patch: Partial<Task>) => void
    onDelete: () => void
    onClose: () => void
}) {
    const {templates} = useTemplates()
    const template = templates.find((candidate) => candidate.id === task.templateId)

    const [title, setTitle] = useState(task.title)
    const [prompt, setPrompt] = useState(task.prompt)
    const [edits, setEdits] = useState<Record<string, FieldValue>>({})

    const stored = useMemo(
        () => (template ? toFieldValues(template, task.values) : {}),
        [template, task.values],
    )

    const values = {...stored, ...edits}
    const missing = template ? missingRequired(template, values) : []
    const ready = title.trim().length > 0 && missing.length === 0

    const editValue = (key: string, value: FieldValue) =>
        setEdits((current) => ({...current, [key]: value}))

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const save = () => {
        if (!ready) return

        onSave({
            title: title.trim(),
            prompt: prompt.trim(),
            values: template ? toParamValues(template, values) : task.values,
        })
        onClose()
    }

    return (
        <DialogShell
            open
            onOpenChange={close}
            title={title.trim() || 'Untitled node'}
            footer={
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 />
                        Delete node
                    </Button>
                    <span className="flex-1" />
                    <MissingInputs count={missing.length} />
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={!ready} onClick={save}>
                        Save
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="micro-label">Template</span>
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <Lock className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate font-mono text-base text-foreground">
                            {template?.name ?? 'No longer available'}
                        </span>
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">Fixed when the node was created.</p>
            </div>

            <InheritedAgent taskLevel={template?.taskLevel} />

            <NodeForm
                params={template?.params ?? []}
                title={title}
                prompt={prompt}
                values={values}
                onTitleChange={setTitle}
                onPromptChange={setPrompt}
                onValueChange={editValue}
            />
        </DialogShell>
    )
}
