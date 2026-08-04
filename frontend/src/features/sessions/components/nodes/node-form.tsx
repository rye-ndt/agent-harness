import {Field} from '@/shared/components/field'
import {ParamFields} from '@/features/templates/components/param-fields'
import {Input} from '@/shared/ui/input'
import {Textarea} from '@/shared/ui/textarea'
import type {FieldValue, TemplateParam} from '@/features/templates/types'

export function NodeForm({
    params,
    title,
    prompt,
    values,
    onTitleChange,
    onPromptChange,
    onValueChange,
}: {
    params: TemplateParam[]
    title: string
    prompt: string
    values: Record<string, FieldValue>
    onTitleChange: (title: string) => void
    onPromptChange: (prompt: string) => void
    onValueChange: (key: string, value: FieldValue) => void
}) {
    return (
        <div className="flex flex-col gap-6 p-4">
            <Field htmlFor="node-title" label="Title">
                <Input
                    id="node-title"
                    value={title}
                    placeholder="Review the auth change"
                    onChange={(event) => onTitleChange(event.target.value)}
                />
            </Field>

            <Field
                htmlFor="node-prompt"
                label="Prompt"
                hint="Starts as the template's prompt. Edit it to change this node only."
            >
                <Textarea
                    id="node-prompt"
                    rows={5}
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                />
            </Field>

            {params.length > 0 && (
                <section className="flex flex-col gap-3">
                    <span className="micro-label">Inputs</span>
                    <ParamFields params={params} values={values} onChange={onValueChange} />
                </section>
            )}
        </div>
    )
}
