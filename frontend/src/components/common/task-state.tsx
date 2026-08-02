import {Check, X} from 'lucide-react'

import {cn} from '@/lib/utils'
import {STATE_SHORT_LABELS} from '@/lib/session'
import type {TaskState} from '@/types/session'

const DOT_CLASSES: Record<TaskState, string> = {
    idle: 'bg-state-idle/40',
    blocked: 'bg-transparent ring-1 ring-inset ring-state-idle/50',
    queued: 'bg-live/40',
    running: 'bg-state-running',
    awaiting_approval: 'bg-state-approval',
    done: 'bg-state-done',
    failed: 'bg-state-failed',
}

const BADGE_CLASSES: Record<TaskState, string> = {
    idle: 'bg-state-idle-tint text-muted-foreground',
    blocked: 'bg-state-idle-tint text-muted-foreground',
    queued: 'bg-live-tint text-live',
    running: 'bg-state-running-tint text-state-running',
    awaiting_approval: 'bg-state-approval-tint text-state-approval',
    done: 'bg-state-done-tint text-state-done',
    failed: 'bg-state-failed-tint text-state-failed',
}

export function StateDot({state, className}: {state: TaskState; className?: string}) {
    return (
        <span className={cn('relative flex size-2 shrink-0', className)}>
            {state === 'running' && (
                <span className="absolute inset-0 animate-ping rounded-full bg-state-running/40 motion-reduce:hidden" />
            )}
            <span className={cn('size-2 rounded-full', DOT_CLASSES[state])} />
        </span>
    )
}

const RING_CLASSES: Partial<Record<TaskState, string>> = {
    queued: 'border-live/40',
    blocked: 'border-dashed border-muted-foreground/50',
    idle: 'border-muted-foreground/40',
}

export function StateIcon({state, className}: {state: TaskState; className?: string}) {
    if (state === 'running') {
        return (
            <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={cn('size-3.5 shrink-0 text-live', className)}
            >
                <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeOpacity="0.15"
                    strokeWidth="2"
                />
                <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="9.4 28.3"
                    className="spin-arc"
                />
            </svg>
        )
    }

    if (state === 'done' || state === 'failed') {
        const Glyph = state === 'done' ? Check : X
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full',
                    state === 'done' ? 'bg-state-done' : 'bg-state-failed',
                    className,
                )}
            >
                <Glyph className="size-2.5 text-white" strokeWidth={3.5} />
            </span>
        )
    }

    if (state === 'awaiting_approval') {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full bg-state-approval text-[0.5625rem] leading-none font-bold text-white',
                    className,
                )}
            >
                !
            </span>
        )
    }

    return (
        <span
            aria-hidden="true"
            className={cn(
                'block size-3.5 shrink-0 rounded-full border-[1.5px]',
                RING_CLASSES[state],
                className,
            )}
        />
    )
}

export function StateBadge({state, className}: {state: TaskState; className?: string}) {
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center rounded-md px-2 text-xs font-medium',
                BADGE_CLASSES[state],
                className,
            )}
        >
            {STATE_SHORT_LABELS[state]}
        </span>
    )
}
