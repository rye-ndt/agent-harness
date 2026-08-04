export function formatTokens(tokens: number) {
    if (tokens < 1000) return String(tokens)

    const thousands = tokens / 1000
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`
}

export function formatPercent(used: number, total: number) {
    if (total <= 0) return 0
    return Math.round(clampRatio(used / total) * 100)
}

export function clampRatio(ratio: number) {
    return Math.min(1, Math.max(0, ratio))
}

export function formatDuration(ms: number) {
    const seconds = Math.floor(Math.max(0, ms) / 1000)
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function formatMoment(iso?: string) {
    if (!iso) return '—'

    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function formatRelative(iso: string) {
    const then = Date.parse(iso)
    if (Number.isNaN(then)) return ''

    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
    if (seconds < 60) return 'just now'

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    if (days < 365) return `${days}d ago`

    return `${Math.floor(days / 365)}y ago`
}

export function formatAgentName(name: string) {
    return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export function pluralize(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`
}
