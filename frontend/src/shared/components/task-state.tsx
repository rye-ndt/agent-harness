import {Check, Square, X} from 'lucide-react'

import {TaskState, TASK_STATE_LABELS} from '@/shared/lib/enums'
import {cn} from '@/shared/lib/utils'

const BADGE_CLASSES: Record<TaskState, string> = {
    [TaskState.Idle]: 'bg-state-idle-tint text-muted-foreground',
    [TaskState.Blocked]: 'bg-state-idle-tint text-muted-foreground',
    [TaskState.Queued]: 'bg-info-tint text-info',
    [TaskState.Running]: 'bg-state-running-tint text-state-running',
    [TaskState.AwaitingApproval]: 'bg-state-approval-tint text-state-approval',
    [TaskState.NeedsInput]: 'bg-state-approval-tint text-state-approval',
    [TaskState.Done]: 'bg-state-done-tint text-state-done',
    [TaskState.Failed]: 'bg-state-failed-tint text-state-failed',
    [TaskState.Cancelled]: 'bg-state-idle text-white',
}

const RING_CLASSES: Partial<Record<TaskState, string>> = {
    [TaskState.Queued]: 'border-info/40',
    [TaskState.Blocked]: 'border-dashed border-muted-foreground/50',
    [TaskState.Idle]: 'border-muted-foreground/40',
}

export function StateIcon({state, className}: {state: TaskState; className?: string}) {
    if (state === TaskState.Running) {
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

    if (state === TaskState.Done || state === TaskState.Failed) {
        const done = state === TaskState.Done
        const Glyph = done ? Check : X

        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full',
                    done ? 'bg-state-done' : 'bg-state-failed',
                    className,
                )}
            >
                <Glyph className="size-2.5 text-white" strokeWidth={3.5} />
            </span>
        )
    }

    if (state === TaskState.Cancelled) {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full bg-state-idle',
                    className,
                )}
            >
                <Square className="size-1.5 fill-white text-white" />
            </span>
        )
    }

    if (state === TaskState.AwaitingApproval || state === TaskState.NeedsInput) {
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
                'inline-flex items-center rounded-sm px-2.5 py-1 text-xs leading-none font-bold tracking-[0.05em] uppercase',
                BADGE_CLASSES[state],
                className,
            )}
        >
            {TASK_STATE_LABELS[state]}
        </span>
    )
}
