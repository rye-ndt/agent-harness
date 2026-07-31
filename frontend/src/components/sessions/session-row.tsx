import {Lock, MoreHorizontal} from 'lucide-react'

import {SessionSpine} from '@/components/sessions/session-spine'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import {sessionProgress} from '@/lib/session'
import type {Session} from '@/types/session'

function formatRelativeTime(iso: string) {
    const then = new Date(iso).getTime()
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

export function SessionRow({
    session,
    active,
    onSelect,
    onClone,
    onDelete,
}: {
    session: Session
    active: boolean
    onSelect: () => void
    onClone: () => void
    onDelete: () => void
}) {
    const {done, total} = sessionProgress(session)
    const relative = formatRelativeTime(session.createdAt)

    return (
        <div className="group relative">
            <button
                type="button"
                onClick={onSelect}
                aria-current={active}
                className={cn(
                    'flex w-full flex-col gap-1.5 rounded-md py-3 pr-8 pl-2.5 text-left transition-colors duration-[120ms] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50',
                    active && 'bg-sidebar-accent',
                )}
            >
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[0.8125rem] font-medium">{session.name}</span>
                    {session.finalized && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    role="img"
                                    aria-label="Finalized"
                                    className="flex shrink-0 text-muted-foreground"
                                >
                                    <Lock className="size-3" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Finalized — duplicate to make changes.
                            </TooltipContent>
                        </Tooltip>
                    )}
                </span>

                <SessionSpine session={session} />

                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {total === 0 ? (
                        <span>No tasks</span>
                    ) : (
                        <span>
                            <span className="font-mono">
                                {done}/{total}
                            </span>{' '}
                            done
                        </span>
                    )}
                    {relative && (
                        <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{relative}</span>
                        </>
                    )}
                </span>
            </button>

            {active && (
                <span className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-live" />
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`Options for ${session.name}`}
                        onClick={(event) => event.stopPropagation()}
                        className="absolute top-2.5 right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-[120ms] outline-none hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100 aria-expanded:opacity-100"
                    >
                        <MoreHorizontal className="size-3.5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={onClone}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
