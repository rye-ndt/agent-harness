import {clampRatio, formatPercent, formatTokens} from '@/shared/lib/format'

const RADIUS = 32

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Drains like the stamina ring on the node: the arc is the context this node has left. */
export function ContextDonut({used, total}: {used: number; total: number}) {
    const spent = total > 0 ? clampRatio(used / total) : 0
    const left = CIRCUMFERENCE * (1 - spent)

    return (
        <div className="relative size-[88px] shrink-0">
            <svg viewBox="0 0 80 80" aria-hidden="true" className="size-full -rotate-90">
                <circle
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--progress-track)"
                    strokeWidth="7"
                />
                <circle
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--progress)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${left} ${CIRCUMFERENCE}`}
                    className="transition-[stroke-dasharray] duration-300 ease-out motion-reduce:transition-none"
                />
            </svg>

            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="font-mono text-base leading-none">{formatTokens(used)}</span>
                <span className="h-px w-5 bg-border" />
                <span className="font-mono text-xs leading-none text-muted-foreground">
                    {formatTokens(total)}
                </span>
            </span>

            <span className="sr-only">
                {formatPercent(used, total)}% of the context window used
            </span>
        </div>
    )
}
