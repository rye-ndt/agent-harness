import {useEffect, useRef} from 'react'

import type {Run} from '@/types/session'

function formatClock(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
}

function formatDuration(from: string, to: string) {
    const ms = new Date(to).getTime() - new Date(from).getTime()
    if (Number.isNaN(ms) || ms < 0) return null
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function timingLine(run: Run) {
    if (!run.startedAt) return 'Not started'
    const started = `Started ${formatClock(run.startedAt)}`
    if (!run.finishedAt) return `${started} · running`
    const duration = formatDuration(run.startedAt, run.finishedAt)
    return duration ? `${started} · took ${duration}` : started
}

export function RunLog({run}: {run: Run}) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight
        if (distance > 40) return
        el.scrollTop = el.scrollHeight
    }, [run.log])

    const live = Boolean(run.startedAt) && !run.finishedAt

    return (
        <div className="flex flex-col gap-1.5">
            <p className="font-mono text-xs text-muted-foreground">{timingLine(run)}</p>
            <div
                ref={scrollRef}
                className="max-h-[200px] overflow-y-auto rounded-md bg-background p-2 ring-1 ring-border"
            >
                {run.log.length === 0 ? (
                    <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
                        No output yet.
                    </p>
                ) : (
                    run.log.map((line, index) => (
                        <p
                            key={index}
                            className={`font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap ${
                                live && index === run.log.length - 1
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            {line}
                        </p>
                    ))
                )}
            </div>
        </div>
    )
}
