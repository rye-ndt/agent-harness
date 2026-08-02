import type {ChangeEvent} from 'react'
import {X} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import type {SystemPrompt} from '@/types/template'

export function PromptEditor({
    index,
    prompt,
    onChange,
    onRemove,
}: {
    index: number
    prompt: SystemPrompt
    onChange: (index: number, fields: Partial<SystemPrompt>) => void
    onRemove: (index: number) => void
}) {
    const remove = () => onRemove(index)

    const changeKey = (event: ChangeEvent<HTMLInputElement>) =>
        onChange(index, {key: event.target.value})

    const changeValue = (event: ChangeEvent<HTMLTextAreaElement>) =>
        onChange(index, {value: event.target.value})

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
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
            <Textarea
                rows={3}
                value={prompt.value}
                aria-label="Prompt text"
                placeholder="You review code. Report only defects you can point to a line for."
                className="bg-background"
                onChange={changeValue}
            />
        </div>
    )
}
