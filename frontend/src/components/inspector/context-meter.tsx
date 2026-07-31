function formatTokens(tokens: number) {
    if (tokens < 1000) return String(tokens)
    return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

export function ContextMeter({used, total}: {used: number; total: number}) {
    const share = total > 0 ? Math.min(1, used / total) : 0
    const percent = Math.round(share * 100)

    const fill =
        share < 0.7 ? 'bg-live' : share < 0.9 ? 'bg-state-approval' : 'bg-state-failed'

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
                <span className="micro-label">Context</span>
                <span className="font-mono text-xs text-muted-foreground">
                    {formatTokens(used)}/{formatTokens(total)} · {percent}%
                </span>
            </div>
            <div
                role="progressbar"
                aria-label="Context used"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1 w-full overflow-hidden rounded-full bg-muted"
            >
                <div
                    className={`h-full rounded-full transition-[width] duration-180 ${fill}`}
                    style={{width: `${percent}%`}}
                />
            </div>
        </div>
    )
}
