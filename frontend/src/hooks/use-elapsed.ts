import {useEffect, useState} from 'react'

import {formatDuration} from '@/lib/format'

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
    if (finishedAt) return Number.isNaN(end) ? null : formatDuration(end - start)
    return formatDuration(now - start)
}
