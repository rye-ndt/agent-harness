import {useRef, type ChangeEvent, type UIEvent} from 'react'

import {paramRefs, promptSegments} from '@/features/templates/param-refs'
import {Textarea} from '@/shared/ui/textarea'
import {cn} from '@/shared/lib/utils'
import type {TemplateParam} from '@/features/templates/types'

const BOX = 'min-h-16 w-full rounded-lg border px-3 py-2 font-mono text-base'

/** A textarea whose `{{key}}` references are coloured by a mirror behind it. */
export function PromptField({
    id,
    value,
    params,
    rows,
    placeholder,
    ariaLabel,
    onChange,
}: {
    id?: string
    value: string
    params: TemplateParam[]
    rows: number
    placeholder?: string
    ariaLabel?: string
    onChange: (value: string) => void
}) {
    const mirror = useRef<HTMLPreElement>(null)
    const known = new Set(params.map((param) => param.key))
    const unknown = paramRefs(value).filter((key) => !known.has(key))

    const sync = (event: UIEvent<HTMLTextAreaElement>) => {
        if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop
    }

    const change = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)

    return (
        <div className="flex flex-col gap-2">
            <div className="relative">
                <pre
                    ref={mirror}
                    aria-hidden="true"
                    className={cn(
                        BOX,
                        'pointer-events-none absolute inset-0 overflow-hidden border-transparent break-words whitespace-pre-wrap text-foreground',
                    )}
                >
                    {promptSegments(value).map((segment, index) =>
                        segment.key === null ? (
                            segment.text
                        ) : (
                            <mark
                                key={index}
                                className={cn(
                                    'rounded-sm',
                                    known.has(segment.key)
                                        ? 'bg-live-tint text-live'
                                        : 'bg-muted text-muted-foreground underline decoration-dotted underline-offset-2',
                                )}
                            >
                                {segment.text}
                            </mark>
                        ),
                    )}
                    {'\n'}
                </pre>

                <Textarea
                    id={id}
                    rows={rows}
                    value={value}
                    placeholder={placeholder}
                    aria-label={ariaLabel}
                    spellCheck={false}
                    className={cn(
                        BOX,
                        'relative resize-none bg-transparent text-transparent caret-foreground',
                    )}
                    onChange={change}
                    onScroll={sync}
                />
            </div>

            {unknown.length > 0 && (
                <p className="text-sm text-state-approval">
                    {unknown.map((key) => `{{${key}}}`).join(', ')}{' '}
                    {unknown.length === 1 ? 'is not an input' : 'are not inputs'} on this template,
                    so it reaches the agent as written.
                </p>
            )}
        </div>
    )
}
