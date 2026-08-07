import {useState} from 'react'
import {ArrowLeft} from 'lucide-react'

import {DialogShell} from '@/shared/components/dialog-shell'
import {StepSpine} from '@/shared/components/step-spine'
import {InheritedAgent} from '@/features/sessions/components/nodes/inherited-agent'
import {NodeForm} from '@/features/sessions/components/nodes/node-form'
import {TemplatesPanel} from '@/features/templates/components/templates-panel'
import {Button} from '@/shared/ui/button'
import {useTemplates} from '@/features/templates/use-templates'
import {
    defaultFieldValues,
    missingRequired,
    promptFromTemplate,
    toParamValues,
} from '@/features/templates/template'
import {pluralize} from '@/shared/lib/format'
import type {TaskDraft} from '@/features/sessions/types'
import type {FieldValue, Template} from '@/features/templates/types'

const STEP_COUNT = 2

export function NewNodeDialog({
    onCreate,
    onClose,
}: {
    onCreate: (draft: TaskDraft) => void
    onClose: () => void
}) {
    const {templates} = useTemplates()

    const [chosenId, setChosenId] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [prompt, setPrompt] = useState('')
    const [values, setValues] = useState<Record<string, FieldValue>>({})

    const chosen = templates.find((template) => template.id === chosenId)
    const missing = chosen ? missingRequired(chosen, values) : []
    const ready = Boolean(chosen) && title.trim().length > 0

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

    return (
        <DialogShell
            open
            onOpenChange={close}
            title={chosen ? chosen.name : 'New node'}
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
                    <PickFooter onCancel={onClose} />
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
                <TemplatesPanel onPick={choose} />
            )}
        </DialogShell>
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
                    {pluralize(missingCount, 'input')} still empty — fill{' '}
                    {missingCount === 1 ? 'it' : 'them'} before you run.
                </span>
            )}
            <Button size="sm" disabled={!ready} onClick={onCreate}>
                Create node
            </Button>
        </>
    )
}

function PickFooter({onCancel}: {onCancel: () => void}) {
    return (
        <>
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
            </Button>
        </>
    )
}
