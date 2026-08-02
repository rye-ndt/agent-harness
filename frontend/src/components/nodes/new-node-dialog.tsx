import {useEffect, useState} from 'react'
import {ArrowLeft, Plus} from 'lucide-react'

import {DialogShell} from '@/components/common/dialog-shell'
import {StepSpine} from '@/components/common/step-spine'
import {NodeForm} from '@/components/nodes/node-form'
import {TemplateFormDialog} from '@/components/templates/template-form-dialog'
import {TemplateList} from '@/components/templates/template-list'
import {Button} from '@/components/ui/button'
import {useTemplates} from '@/hooks/use-templates'
import {defaultFieldValues, missingRequired, toParamValues} from '@/lib/template'
import type {TaskDraft} from '@/types/session'
import type {FieldValue, Template} from '@/types/template'

type TemplateEdit = {template: Template | null}

export function NewNodeDialog({
    open,
    onOpenChange,
    onCreate,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (draft: TaskDraft) => void
}) {
    const {templates, loading, removeTemplate} = useTemplates()
    const [chosenId, setChosenId] = useState<string | null>(null)
    const [editing, setEditing] = useState<TemplateEdit | null>(null)

    const [title, setTitle] = useState('')
    const [prompt, setPrompt] = useState('')
    const [values, setValues] = useState<Record<string, FieldValue>>({})

    const chosen = templates.find((template) => template.id === chosenId)

    useEffect(() => {
        if (open) return
        setChosenId(null)
        setEditing(null)
    }, [open])

    const choose = (template: Template) => {
        setChosenId(template.id)
        setTitle(template.name)
        setPrompt(template.systemPrompts.map((entry) => entry.value).join('\n\n'))
        setValues(defaultFieldValues(template))
    }

    const missing = chosen ? missingRequired(chosen, values) : []
    const ready = Boolean(chosen) && title.trim().length > 0 && missing.length === 0

    const create = () => {
        if (!chosen || !ready) return

        onCreate({
            title: title.trim(),
            prompt: prompt.trim(),
            templateId: chosen.id,
            values: toParamValues(chosen, values),
        })
    }

    return (
        <>
            <DialogShell
                open={open}
                onOpenChange={onOpenChange}
                title={chosen ? chosen.name : 'New node'}
                description={chosen ? undefined : 'Every node starts from a template.'}
                aside={<StepSpine total={2} current={chosen ? 1 : 0} />}
                footer={
                    chosen ? (
                        <FillFooter
                            missingCount={missing.length}
                            ready={ready}
                            onBack={() => setChosenId(null)}
                            onCreate={create}
                        />
                    ) : (
                        <PickFooter
                            onNewTemplate={() => setEditing({template: null})}
                            onCancel={() => onOpenChange(false)}
                        />
                    )
                }
            >
                {chosen ? (
                    <NodeForm
                        key={chosen.id}
                        params={chosen.params}
                        title={title}
                        prompt={prompt}
                        values={values}
                        onTitleChange={setTitle}
                        onPromptChange={setPrompt}
                        onValueChange={(key, value) =>
                            setValues((current) => ({...current, [key]: value}))
                        }
                    />
                ) : (
                    <TemplateList
                        templates={templates}
                        loading={loading}
                        onPick={choose}
                        onEdit={(template) => setEditing({template})}
                        onRemove={removeTemplate}
                        onCreate={() => setEditing({template: null})}
                    />
                )}
            </DialogShell>

            <TemplateFormDialog
                open={editing !== null}
                template={editing?.template ?? null}
                onOpenChange={(next) => !next && setEditing(null)}
            />
        </>
    )
}

function FillFooter({
    missingCount,
    ready,
    onBack,
    onCreate,
}: {
    missingCount: number
    ready: boolean
    onBack: () => void
    onCreate: () => void
}) {
    return (
        <>
            <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft />
                Templates
            </Button>
            <span className="flex-1" />
            {missingCount > 0 && (
                <span className="text-sm text-muted-foreground">
                    {missingCount} required input{missingCount === 1 ? '' : 's'} left
                </span>
            )}
            <Button size="sm" disabled={!ready} onClick={onCreate}>
                Create node
            </Button>
        </>
    )
}

function PickFooter({onNewTemplate, onCancel}: {onNewTemplate: () => void; onCancel: () => void}) {
    return (
        <>
            <Button variant="ghost" size="sm" onClick={onNewTemplate}>
                <Plus />
                New template
            </Button>
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
            </Button>
        </>
    )
}
