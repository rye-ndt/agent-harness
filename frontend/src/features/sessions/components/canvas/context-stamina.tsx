import {clampRatio, formatPercent, formatTokens} from '@/shared/lib/format'
import {cn} from '@/shared/lib/utils'

const RADIUS = 8

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ringClass(spent: number) {
    if (spent < 0.7) return 'stroke-progress'
    if (spent < 0.9) return 'stroke-state-approval'
    return 'stroke-state-failed'
}

/** Drains as the node spends its context window: full ring at the start, empty when it runs out. */
export function ContextStamina({used, total}: {used: number; total: number}) {
    const spent = total > 0 ? clampRatio(used / total) : 0
    const left = CIRCUMFERENCE * (1 - spent)
    const reading = `${formatTokens(used)} of ${formatTokens(total)} context used`

    return (
        <span className="relative flex size-5 shrink-0 items-center justify-center" title={reading}>
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-full -rotate-90">
                <circle
                    cx="10"
                    cy="10"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-progress-track"
                />
                <circle
                    cx="10"
                    cy="10"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${left} ${CIRCUMFERENCE}`}
                    className={cn(
                        'transition-[stroke-dasharray] duration-300 ease-out motion-reduce:transition-none',
                        ringClass(spent),
                        spent >= 0.98 && 'animate-pulse motion-reduce:animate-none',
                    )}
                />
            </svg>

            <span className="sr-only">
                {formatPercent(used, total)}% of the context window used
            </span>
        </span>
    )
}
