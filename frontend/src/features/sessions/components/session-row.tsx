import type {MouseEvent} from 'react'
import {Lock, MoreHorizontal} from 'lucide-react'

import {SessionSpine} from '@/features/sessions/components/session-spine'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/shared/ui/tooltip'
import {formatRelative} from '@/shared/lib/format'
import {sessionProgress} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Session} from '@/features/sessions/types'

const FINALIZED_HINT = 'Finalized — duplicate to make changes.'

export function SessionRow({
    session,
    active,
    onSelect,
    onClone,
    onDelete,
}: {
    session: Session
    active: boolean
    onSelect: (sessionId: string) => void
    onClone: (sessionId: string) => void
    onDelete: (sessionId: string) => void
}) {
    const {done, total} = sessionProgress(session)
    const relative = formatRelative(session.createdAt)

    const select = () => onSelect(session.id)
    const clone = () => onClone(session.id)
    const remove = () => onDelete(session.id)
    const stopPropagation = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()

    return (
        <div className="group relative">
            <button
                type="button"
                onClick={select}
                aria-current={active}
                className={cn(
                    'flex w-full flex-col gap-2 rounded-md px-2 py-3 pr-8 text-left transition-colors duration-[120ms] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50',
                    active && 'bg-sidebar-accent',
                )}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-medium">{session.name}</span>
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
                            <TooltipContent side="bottom">{FINALIZED_HINT}</TooltipContent>
                        </Tooltip>
                    )}
                </span>

                <SessionSpine session={session} />

                <span className="flex items-center gap-1 text-sm text-muted-foreground">
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
                        onClick={stopPropagation}
                        className="absolute top-2 right-1 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-[120ms] outline-none hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100 aria-expanded:opacity-100"
                    >
                        <MoreHorizontal className="size-3.5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={clone}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={remove}>
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
