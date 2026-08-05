import {useMemo, useState} from 'react'

import {DialogShell} from '@/shared/components/dialog-shell'
import {MissingInputs} from '@/features/sessions/components/nodes/missing-inputs'
import {ParamFields} from '@/features/templates/components/param-fields'
import {PromptPreview} from '@/features/templates/components/prompt-preview'
import {Button} from '@/shared/ui/button'
import {useTemplates} from '@/features/templates/use-templates'
import {toFieldValues, toParamValues} from '@/features/templates/template'
import {paramRefs} from '@/features/templates/param-refs'
import {pendingParams} from '@/features/sessions/task-inputs'
import {pluralize} from '@/shared/lib/format'
import type {Task} from '@/features/sessions/types'
import type {FieldValue, ParamValue} from '@/features/templates/types'

export function TaskInputsDialog({
    task,
    waiting,
    busy,
    onStart,
    onClose,
}: {
    task: Task
    waiting: number
    busy: boolean
    onStart: (values: Record<string, ParamValue>) => void
    onClose: () => void
}) {
    const {templates} = useTemplates()
    const template = templates.find((candidate) => candidate.id === task.templateId)

    const [edits, setEdits] = useState<Record<string, FieldValue>>({})

    const stored = useMemo(
        () => (template ? toFieldValues(template, task.values) : {}),
        [template, task.values],
    )

    const values = {...stored, ...edits}
    const pending = template
        ? pendingParams({...task, values: toParamValues(template, values)}, template)
        : []
    const embedded = paramRefs(task.prompt).length > 0

    const editValue = (key: string, value: FieldValue) =>
        setEdits((current) => ({...current, [key]: value}))

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const start = () => {
        if (!template || pending.length > 0 || busy) return
        onStart(toParamValues(template, values))
    }

    return (
        <DialogShell
            open
            onOpenChange={close}
            title={task.title || 'Untitled node'}
            description="Waiting on you. This node runs as soon as its inputs are filled."
            aside={
                waiting > 1 ? (
                    <span className="micro-label shrink-0">
                        {pluralize(waiting, 'node')} waiting
                    </span>
                ) : undefined
            }
            footer={
                <>
                    <span className="flex-1" />
                    <MissingInputs count={pending.length} />
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Not now
                    </Button>
                    <Button size="sm" disabled={pending.length > 0 || busy} onClick={start}>
                        {busy ? 'Starting…' : 'Start node'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-6 p-4">
                {template ? (
                    <ParamFields params={template.params} values={values} onChange={editValue} />
                ) : (
                    <p className="text-base text-muted-foreground">
                        This node's template is gone, so its inputs cannot be read. Duplicate the
                        session and rebuild the node.
                    </p>
                )}

                {embedded && (
                    <section className="flex flex-col gap-3">
                        <span className="micro-label">Prompt the agent receives</span>
                        <PromptPreview prompt={task.prompt} values={values} />
                    </section>
                )}
            </div>
        </DialogShell>
    )
}
