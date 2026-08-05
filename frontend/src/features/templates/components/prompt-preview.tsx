import {promptSegments} from '@/features/templates/param-refs'
import {cn} from '@/shared/lib/utils'
import type {FieldValue} from '@/features/templates/types'

/** The prompt as the agent will read it, with every `{{key}}` already resolved. */
export function PromptPreview({
    prompt,
    values,
}: {
    prompt: string
    values: Record<string, FieldValue>
}) {
    return (
        <pre className="rounded-xl border border-border bg-muted/40 p-3 font-mono text-sm break-words whitespace-pre-wrap">
            {promptSegments(prompt).map((segment, index) => {
                if (segment.key === null) return segment.text

                const value = String(values[segment.key] ?? '')

                return (
                    <mark
                        key={index}
                        className={cn(
                            'rounded-sm',
                            value === ''
                                ? 'bg-state-approval-tint text-state-approval underline decoration-dotted underline-offset-2'
                                : 'bg-live-tint text-live',
                        )}
                    >
                        {value === '' ? segment.text : value}
                    </mark>
                )
            })}
        </pre>
    )
}
