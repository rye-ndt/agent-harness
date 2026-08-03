import {useState} from 'react'
import {ArrowLeft, Plus} from 'lucide-react'

import {DialogShell} from '@/components/common/dialog-shell'
import {StepSpine} from '@/components/common/step-spine'
import {InheritedAgent} from '@/components/nodes/inherited-agent'
import {MissingInputs} from '@/components/nodes/missing-inputs'
import {NodeForm} from '@/components/nodes/node-form'
import {TemplateFormDialog} from '@/components/templates/template-form-dialog'
import {TemplateList} from '@/components/templates/template-list'
import {Button} from '@/components/ui/button'
import {useTemplates} from '@/hooks/use-templates'
import {defaultFieldValues, missingRequired, promptFromTemplate, toParamValues} from '@/lib/template'
import type {TaskDraft} from '@/types/session'
import type {FieldValue, Template} from '@/types/template'

type TemplateEdit = {template: Template | null}

const STEP_COUNT = 2

export function NewNodeDialog({
    onCreate,
    onClose,
}: {
    onCreate: (draft: TaskDraft) => void
    onClose: () => void
}) {
    const {templates, loading, removeTemplate} = useTemplates()

    const [chosenId, setChosenId] = useState<string | null>(null)
    const [editing, setEditing] = useState<TemplateEdit | null>(null)
    const [title, setTitle] = useState('')
    const [prompt, setPrompt] = useState('')
    const [values, setValues] = useState<Record<string, FieldValue>>({})

    const chosen = templates.find((template) => template.id === chosenId)
    const missing = chosen ? missingRequired(chosen, values) : []
    const ready = Boolean(chosen) && title.trim().length > 0 && missing.length === 0

    const choose = (template: Template) => {
        setChosenId(template.id)
        setTitle(template.name)
        setPrompt(promptFromTemplate(template))
        setValues(defaultFieldValues(template))
    }

    const back = () => setChosenId(null)

    const changeValue = (key: string, value: FieldValue) =>
        setValues((current) => ({...current, [key]: value}))

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const create = () => {
        if (!chosen || !ready) return

        onCreate({
            title: title.trim(),
            prompt: prompt.trim(),
            templateId: chosen.id,
            values: toParamValues(chosen, values),
        })
    }

    const newTemplate = () => setEditing({template: null})
    const editTemplate = (template: Template) => setEditing({template})
    const closeTemplateForm = () => setEditing(null)

    return (
        <>
            <DialogShell
                open
                onOpenChange={close}
                title={chosen ? chosen.name : 'New node'}
                description={chosen ? undefined : 'Every node starts from a template.'}
                aside={<StepSpine total={STEP_COUNT} current={chosen ? 1 : 0} />}
                footer={
                    chosen ? (
                        <FillFooter
                            missingCount={missing.length}
                            ready={ready}
                            onBack={back}
                            onCreate={create}
                        />
                    ) : (
                        <PickFooter onNewTemplate={newTemplate} onCancel={onClose} />
                    )
                }
            >
                {chosen ? (
                    <>
                        <InheritedAgent taskLevel={chosen.taskLevel} />
                        <NodeForm
                            key={chosen.id}
                            params={chosen.params}
                            title={title}
                            prompt={prompt}
                            values={values}
                            onTitleChange={setTitle}
                            onPromptChange={setPrompt}
                            onValueChange={changeValue}
                        />
                    </>
                ) : (
                    <TemplateList
                        templates={templates}
                        loading={loading}
                        onPick={choose}
                        onEdit={editTemplate}
                        onRemove={removeTemplate}
                        onCreate={newTemplate}
                    />
                )}
            </DialogShell>

            {editing && (
                <TemplateFormDialog template={editing.template} onClose={closeTemplateForm} />
            )}
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
            <MissingInputs count={missingCount} />
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
