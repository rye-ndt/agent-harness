import {clampRatio, formatPercent, formatTokens} from '@/lib/format'

const RADIUS = 32

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ContextDonut({used, total}: {used: number; total: number}) {
    const share = total > 0 ? clampRatio(used / total) : 0

    return (
        <div className="relative size-[88px] shrink-0">
            <svg viewBox="0 0 80 80" aria-hidden="true" className="size-full -rotate-90">
                <circle
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="7"
                />
                <circle
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--live)"
                    strokeWidth="7"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - share)}
                    className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
                />
            </svg>

            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="font-mono text-base leading-none">{formatTokens(used)}</span>
                <span className="h-px w-5 bg-border" />
                <span className="font-mono text-xs leading-none text-muted-foreground">
                    {formatTokens(total)}
                </span>
            </span>

            <span className="sr-only">{formatPercent(used, total)}% of the context window used</span>
        </div>
    )
}
