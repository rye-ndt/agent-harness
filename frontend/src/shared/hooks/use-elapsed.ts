import {useEffect, useState} from 'react'

import {formatDuration} from '@/shared/lib/format'

export function useElapsed(startedAt?: string, finishedAt?: string): string | null {
    const start = startedAt ? Date.parse(startedAt) : Number.NaN
    const end = finishedAt ? Date.parse(finishedAt) : Number.NaN
    const ticking = !Number.isNaN(start) && !finishedAt

    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!ticking) return

        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [ticking, start])

    if (Number.isNaN(start)) return null
    if (finishedAt) return Number.isNaN(end) ? null : formatDuration(end - start)
    return formatDuration(Math.max(0, now - start))
}
