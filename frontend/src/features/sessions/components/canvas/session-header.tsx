import {useState, type ChangeEvent, type ComponentType, type KeyboardEvent} from 'react'
import {
    CircleStop,
    Copy,
    Folder,
    Lock,
    PanelLeftClose,
    PanelLeftOpen,
    Play,
    Plus,
    Settings,
} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {ConfirmDialog} from '@/shared/components/confirm-dialog'
import {SessionMenu} from '@/features/sessions/components/canvas/session-menu'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/shared/ui/tooltip'
import {SessionStatus, SESSION_STATUS_LABELS} from '@/shared/lib/enums'
import {isCancellable, sessionProgress, sessionStatus} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Session} from '@/features/sessions/types'

const STATUS_CLASSES: Record<SessionStatus, string> = {
    [SessionStatus.Empty]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Draft]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Ready]: 'bg-info-tint text-info',
    [SessionStatus.Running]: 'bg-state-running-tint text-state-running',
    [SessionStatus.Done]: 'bg-state-done-tint text-state-done',
    [SessionStatus.Failed]: 'bg-state-failed-tint text-state-failed',
    [SessionStatus.Cancelled]: 'bg-state-idle text-white',
}

const FINALIZED_HINT = 'Finalized — duplicate to make changes.'

const CANCEL_BODY =
    'The node running right now loses its work — there will be no report for it. Finished nodes keep theirs, and the session stays on the rail. You cannot resume a cancelled run; duplicate it to start over.'

export function SessionHeader({
    session,
    error,
    onRename,
    onEditLocations,
    onFinalize,
    onRun,
    onCancel,
    cancelling,
    onClone,
    onNewNode,
    onOpenSettings,
    railOpen,
    onToggleRail,
}: {
    session: Session | null
    error: string
    onRename: (name: string) => void
    onEditLocations: () => void
    onFinalize: () => void
    onRun: () => void
    onCancel: () => void
    cancelling: boolean
    onClone: () => void
    onNewNode: () => void
    onOpenSettings: () => void
    railOpen: boolean
    onToggleRail: () => void
}) {
    const locked = session?.finalized ?? false
    const runnable = locked && !session?.started
    const cancellable = session ? isCancellable(session) : false
    const [confirmingFinalize, setConfirmingFinalize] = useState(false)
    const [confirmingCancel, setConfirmingCancel] = useState(false)

    const askFinalize = () => setConfirmingFinalize(true)
    const cancelFinalize = () => setConfirmingFinalize(false)

    const askCancel = () => setConfirmingCancel(true)
    const keepRunning = () => setConfirmingCancel(false)

    const finalize = () => {
        setConfirmingFinalize(false)
        onFinalize()
    }

    const cancelRun = () => {
        setConfirmingCancel(false)
        onCancel()
    }

    return (
        <header className="shrink-0">
            <div className="flex h-14 items-center gap-3 border-b border-border-strong bg-card px-4">
                <RailToggle open={railOpen} onToggle={onToggleRail} />

                <SessionMenu
                    session={session}
                    onEditLocations={onEditLocations}
                    onFinalize={askFinalize}
                    onRun={onRun}
                    onCancel={askCancel}
                    onClone={onClone}
                    onNewNode={onNewNode}
                    onOpenSettings={onOpenSettings}
                />

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

                <div className="hidden shrink-0 items-center gap-2 lg:flex">
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
                                    onClick={askFinalize}
                                />
                            )}
                            {runnable && (
                                <HeaderAction
                                    label="Run"
                                    icon={Play}
                                    variant="default"
                                    onClick={onRun}
                                />
                            )}
                            {cancellable && (
                                <HeaderAction
                                    label="Cancel run"
                                    icon={CircleStop}
                                    variant="outline"
                                    onClick={askCancel}
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

            {confirmingFinalize && session && (
                <ConfirmDialog
                    title={`Finalize “${session.name}”?`}
                    description="The graph and its directories lock for good. To change anything after this you have to duplicate the session. Nothing runs until you press Run."
                    confirmLabel="Finalize session"
                    onConfirm={finalize}
                    onClose={cancelFinalize}
                />
            )}

            {confirmingCancel && session && (
                <ConfirmDialog
                    title="Cancel the run?"
                    description={CANCEL_BODY}
                    confirmLabel="Cancel run"
                    dismissLabel="Keep running"
                    destructive
                    busy={cancelling}
                    onConfirm={cancelRun}
                    onClose={keepRunning}
                />
            )}
        </header>
    )
}

function RailToggle({open, onToggle}: {open: boolean; onToggle: () => void}) {
    const label = open ? 'Hide sessions' : 'Show sessions'

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-1 shrink-0"
                    aria-label={label}
                    onClick={onToggle}
                >
                    {open ? <PanelLeftClose /> : <PanelLeftOpen />}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
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
    variant: 'default' | 'outline' | 'ghost'
    onClick: () => void
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant={variant} size="sm" aria-label={label} onClick={onClick}>
                    <Icon />
                    <span className={cn(variant === 'default' ? 'inline' : 'hidden xl:inline')}>
                        {label}
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
                className={variant === 'default' ? 'hidden' : 'xl:hidden'}
            >
                {label}
            </TooltipContent>
        </Tooltip>
    )
}

function FinalizedName({name}: {name: string}) {
    return (
        <span className="flex w-full max-w-96 min-w-0 items-center gap-1 lg:min-w-40">
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
            className="-ml-2 w-full max-w-96 min-w-0 truncate rounded-md bg-transparent px-2 py-1 text-xl font-bold outline-none transition-colors hover:bg-muted focus:bg-background focus-visible:ring-2 focus-visible:ring-live lg:min-w-40"
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
                    className="hidden min-w-0 shrink items-center gap-2 rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-live lg:flex lg:max-w-40 xl:max-w-72"
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

            <span className="hidden font-mono text-sm text-muted-foreground lg:block">
                {done}/{total}
            </span>
        </span>
    )
}
