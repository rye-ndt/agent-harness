import {useEffect, useRef, type UIEvent} from 'react'

import {cn} from '@/shared/lib/utils'
import type {ActivityLine} from '@/features/sessions/types'

const STICK_SLACK_PX = 16

/** What the running node is doing right now, spoken above the node it belongs to. */
export function ActivityBubble({lines}: {lines: ActivityLine[]}) {
    const feed = useRef<HTMLOListElement>(null)
    const stick = useRef(true)
    const newest = lines.at(-1)

    useEffect(() => {
        const el = feed.current
        if (!el || !stick.current) return
        el.scrollTop = el.scrollHeight
    }, [newest?.seq])

    function trackStick(event: UIEvent<HTMLOListElement>) {
        const el = event.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_SLACK_PX
    }

    if (!newest) return null

    return (
        <div className="absolute bottom-full left-0 mb-2 w-full animate-in rounded-lg bg-card p-2.5 ring-1 ring-live/25 duration-200 fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
            <span className="sr-only">What this node is doing now</span>

            <ol
                ref={feed}
                onScroll={trackStick}
                className="nowheel nodrag max-h-22 space-y-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_1rem)]"
            >
                {lines.map((line) => (
                    <li key={line.seq} className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1 shrink-0 rounded-full',
                                line.seq === newest.seq ? 'bg-live' : 'bg-border-strong',
                            )}
                        />
                        <span
                            title={line.text}
                            className={cn(
                                'min-w-0 flex-1 truncate text-sm',
                                line.seq === newest.seq
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {line.text}
                        </span>
                    </li>
                ))}
            </ol>

            <span
                aria-hidden="true"
                className="absolute -bottom-[5px] left-[13px] -z-10 size-2.5 rotate-45 rounded-[2px] bg-card ring-1 ring-live/25"
            />
        </div>
    )
}
