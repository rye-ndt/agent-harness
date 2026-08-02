import {useEffect, useState} from 'react'
import {Copy, Lock, Plus, Settings} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {sessionProgress, sessionStatus} from '@/lib/session'
import {cn} from '@/lib/utils'
import type {Session, SessionStatus} from '@/types/session'

const STATUS_LABELS: Record<SessionStatus, string> = {
    empty: 'Empty',
    draft: 'Draft',
    running: 'Running',
    done: 'Done',
    failed: 'Failed',
}

const STATUS_CLASSES: Record<SessionStatus, string> = {
    empty: 'bg-state-idle-tint text-muted-foreground',
    draft: 'bg-state-idle-tint text-muted-foreground',
    running: 'bg-state-running-tint text-state-running',
    done: 'bg-state-done-tint text-state-done',
    failed: 'bg-state-failed-tint text-state-failed',
}

export function SessionHeader({
    session,
    onRename,
    onFinalize,
    onClone,
    onNewNode,
    onOpenSettings,
}: {
    session: Session | null
    onRename: (name: string) => void
    onFinalize: () => void
    onClone: () => void
    onNewNode: () => void
    onOpenSettings: () => void
}) {
    const [name, setName] = useState(session?.name ?? '')

    useEffect(() => {
        setName(session?.name ?? '')
    }, [session?.id, session?.name])

    const commit = () => {
        if (!session) return

        const next = name.trim()
        if (!next) {
            setName(session.name)
            return
        }
        if (next !== session.name) onRename(next)
    }

    return (
        <header className="shrink-0">
            <div className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {session &&
                        (session.finalized ? (
                            <span className="flex min-w-0 items-center gap-1">
                                <span className="truncate text-xl font-semibold">
                                    {session.name}
                                </span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="This session is finalized"
                                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-live"
                                        >
                                            <Lock className="size-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        Finalized — duplicate to make changes.
                                    </TooltipContent>
                                </Tooltip>
                            </span>
                        ) : (
                            <input
                                value={name}
                                aria-label="Session name"
                                onChange={(event) => setName(event.target.value)}
                                onBlur={commit}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') event.currentTarget.blur()
                                    if (event.key === 'Escape') {
                                        setName(session.name)
                                        event.currentTarget.blur()
                                    }
                                }}
                                className="-ml-2 w-full max-w-96 min-w-0 rounded-md bg-transparent px-2 py-1 text-xl font-semibold outline-none transition-colors hover:bg-muted focus:bg-background focus-visible:ring-2 focus-visible:ring-live"
                            />
                        ))}

                    {session && <SessionIdentity session={session} />}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {session && (
                        <>
                            {!session.finalized && (
                                <Button variant="outline" size="sm" onClick={onNewNode}>
                                    <Plus />
                                    New node
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={onClone}>
                                <Copy />
                                Duplicate
                            </Button>
                            {!session.finalized && (
                                <Button variant="outline" size="sm" onClick={onFinalize}>
                                    <Lock />
                                    Finalize
                                </Button>
                            )}
                            <span className="mx-1 h-5 w-px bg-border" />
                        </>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Settings"
                                onClick={onOpenSettings}
                            >
                                <Settings />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Settings</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </header>
    )
}

function SessionIdentity({session}: {session: Session}) {
    const status = sessionStatus(session)
    const {done, total} = sessionProgress(session)

    return (
        <span className="flex shrink-0 items-center gap-3">
            <span
                className={cn(
                    'inline-flex h-5 items-center rounded-md px-2 text-xs font-medium',
                    STATUS_CLASSES[status],
                )}
            >
                {STATUS_LABELS[status]}
            </span>

            <span className="font-mono text-sm text-muted-foreground">
                {done}/{total}
            </span>
        </span>
    )
}
