import {useState, type ChangeEvent, type ComponentType, type KeyboardEvent} from 'react'
import {Copy, Folder, Lock, Plus, Settings} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/shared/ui/tooltip'
import {SessionStatus, SESSION_STATUS_LABELS} from '@/shared/lib/enums'
import {sessionProgress, sessionStatus} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Session} from '@/features/sessions/types'

const STATUS_CLASSES: Record<SessionStatus, string> = {
    [SessionStatus.Empty]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Draft]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Running]: 'bg-state-running-tint text-state-running',
    [SessionStatus.Done]: 'bg-state-done-tint text-state-done',
    [SessionStatus.Failed]: 'bg-state-failed-tint text-state-failed',
}

const FINALIZED_HINT = 'Finalized — duplicate to make changes.'

export function SessionHeader({
    session,
    error,
    onRename,
    onEditLocations,
    onFinalize,
    onClone,
    onNewNode,
    onOpenSettings,
}: {
    session: Session | null
    error: string
    onRename: (name: string) => void
    onEditLocations: () => void
    onFinalize: () => void
    onClone: () => void
    onNewNode: () => void
    onOpenSettings: () => void
}) {
    const locked = session?.finalized ?? false

    return (
        <header className="shrink-0">
            <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {session &&
                        (locked ? (
                            <FinalizedName name={session.name} />
                        ) : (
                            <SessionNameInput
                                key={session.id}
                                name={session.name}
                                onRename={onRename}
                            />
                        ))}

                    {session && <SessionDirectories session={session} onEdit={onEditLocations} />}

                    {session && <SessionIdentity session={session} />}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {session && (
                        <>
                            {!locked && (
                                <HeaderAction
                                    label="New node"
                                    icon={Plus}
                                    variant="outline"
                                    onClick={onNewNode}
                                />
                            )}
                            <HeaderAction
                                label="Duplicate"
                                icon={Copy}
                                variant="ghost"
                                onClick={onClone}
                            />
                            {!locked && (
                                <HeaderAction
                                    label="Finalize"
                                    icon={Lock}
                                    variant="outline"
                                    onClick={onFinalize}
                                />
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

            {error && (
                <p
                    role="alert"
                    className="border-b border-border bg-state-failed-tint px-4 py-3 text-sm text-destructive"
                >
                    {error}
                </p>
            )}
        </header>
    )
}

function HeaderAction({
    label,
    icon: Icon,
    variant,
    onClick,
}: {
    label: string
    icon: ComponentType<{className?: string}>
    variant: 'outline' | 'ghost'
    onClick: () => void
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant={variant} size="sm" aria-label={label} onClick={onClick}>
                    <Icon />
                    <span className="hidden xl:inline">{label}</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="xl:hidden">
                {label}
            </TooltipContent>
        </Tooltip>
    )
}

function FinalizedName({name}: {name: string}) {
    return (
        <span className="flex w-full max-w-96 min-w-40 items-center gap-1">
            <span className="truncate text-xl font-bold">{name}</span>
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
                <TooltipContent side="bottom">{FINALIZED_HINT}</TooltipContent>
            </Tooltip>
        </span>
    )
}

function SessionNameInput({name, onRename}: {name: string; onRename: (name: string) => void}) {
    const [draft, setDraft] = useState(name)

    const change = (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)

    const commit = () => {
        const next = draft.trim()
        if (!next) {
            setDraft(name)
            return
        }

        if (next !== name) onRename(next)
    }

    const handleKeys = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
            setDraft(name)
            event.currentTarget.blur()
        }
    }

    return (
        <input
            value={draft}
            aria-label="Session name"
            onChange={change}
            onBlur={commit}
            onKeyDown={handleKeys}
            className="-ml-2 w-full max-w-96 min-w-40 rounded-md bg-transparent px-2 py-1 text-xl font-bold outline-none transition-colors hover:bg-muted focus:bg-background focus-visible:ring-2 focus-visible:ring-live"
        />
    )
}

function SessionDirectories({session, onEdit}: {session: Session; onEdit: () => void}) {
    const paths = [session.workingDir, session.contextDir].filter(Boolean)
    if (paths.length === 0) return null

    if (session.finalized)
        return (
            <span className="hidden min-w-0 shrink truncate font-mono text-sm text-muted-foreground lg:block lg:max-w-40 xl:max-w-72">
                {session.workingDir}
            </span>
        )

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label="Session directories"
                    onClick={onEdit}
                    className="flex min-w-0 shrink items-center gap-2 rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-live lg:max-w-40 xl:max-w-72"
                >
                    <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="hidden truncate font-mono text-sm text-muted-foreground lg:block">
                        {session.workingDir}
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <span className="flex flex-col gap-1">
                    {paths.map((path) => (
                        <span key={path} className="font-mono">
                            {path}
                        </span>
                    ))}
                    <span>Click to change either one.</span>
                </span>
            </TooltipContent>
        </Tooltip>
    )
}

function SessionIdentity({session}: {session: Session}) {
    const status = sessionStatus(session)
    const {done, total} = sessionProgress(session)

    return (
        <span className="flex shrink-0 items-center gap-3">
            <span
                className={cn(
                    'inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-bold tracking-[0.05em] uppercase',
                    STATUS_CLASSES[status],
                )}
            >
                {SESSION_STATUS_LABELS[status]}
            </span>

            <span className="font-mono text-sm text-muted-foreground">
                {done}/{total}
            </span>
        </span>
    )
}
