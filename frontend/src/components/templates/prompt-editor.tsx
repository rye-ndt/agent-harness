import {X} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import type {SystemPrompt} from '@/types/template'

export function PromptEditor({
    prompt,
    onChange,
    onRemove,
}: {
    prompt: SystemPrompt
    onChange: (fields: Partial<SystemPrompt>) => void
    onRemove: () => void
}) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
                <Input
                    value={prompt.key}
                    placeholder="base"
                    aria-label="Prompt key"
                    className="h-8 flex-1 bg-background font-mono"
                    onChange={(event) => onChange({key: event.target.value})}
                />
                <Button variant="ghost" size="icon-sm" aria-label="Remove prompt" onClick={onRemove}>
                    <X />
                </Button>
            </div>
            <Textarea
                rows={3}
                value={prompt.value}
                aria-label="Prompt text"
                placeholder="You review code. Report only defects you can point to a line for."
                className="bg-background"
                onChange={(event) => onChange({value: event.target.value})}
            />
        </div>
    )
}
