import {useEffect, useState} from 'react'

function formatElapsed(ms: number) {
    const seconds = Math.floor(Math.max(0, ms) / 1000)
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function useElapsed(startedAt?: string, finishedAt?: string): string | null {
    const start = startedAt ? Date.parse(startedAt) : Number.NaN
    const end = finishedAt ? Date.parse(finishedAt) : Number.NaN
    const ticking = !Number.isNaN(start) && !finishedAt

    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!ticking) return
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [ticking, start])

    if (Number.isNaN(start)) return null
    if (finishedAt) return Number.isNaN(end) ? null : formatElapsed(end - start)
    return formatElapsed(now - start)
}
