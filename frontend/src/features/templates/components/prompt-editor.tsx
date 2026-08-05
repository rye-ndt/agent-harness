import type {ChangeEvent} from 'react'
import {X} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'
import {PromptField} from '@/features/templates/components/prompt-field'
import type {SystemPrompt, TemplateParam} from '@/features/templates/types'

export function PromptEditor({
    index,
    prompt,
    params,
    onChange,
    onRemove,
}: {
    index: number
    prompt: SystemPrompt
    params: TemplateParam[]
    onChange: (index: number, fields: Partial<SystemPrompt>) => void
    onRemove: (index: number) => void
}) {
    const remove = () => onRemove(index)

    const changeKey = (event: ChangeEvent<HTMLInputElement>) =>
        onChange(index, {key: event.target.value})

    const changeValue = (value: string) => onChange(index, {value})

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
                <Input
                    value={prompt.key}
                    placeholder="base"
                    aria-label="Prompt key"
                    className="h-8 flex-1 bg-background font-mono"
                    onChange={changeKey}
                />
                <Button variant="ghost" size="icon-sm" aria-label="Remove prompt" onClick={remove}>
                    <X />
                </Button>
            </div>
            <PromptField
                rows={3}
                value={prompt.value}
                params={params}
                ariaLabel="Prompt text"
                placeholder="Fetch the ticket at https://jira/browse/{{ticket_id}} and summarise it."
                onChange={changeValue}
            />
        </div>
    )
}
