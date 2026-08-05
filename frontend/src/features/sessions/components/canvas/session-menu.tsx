import {useState, type ComponentType} from 'react'
import {CircleStop, Copy, Lock, Menu, Play, Plus, Settings} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/shared/ui/sheet'
import {isCancellable, sessionProgress} from '@/features/sessions/graph'
import type {Session} from '@/features/sessions/types'

export function SessionMenu({
    session,
    onEditLocations,
    onFinalize,
    onRun,
    onCancel,
    onClone,
    onNewNode,
    onOpenSettings,
}: {
    session: Session | null
    onEditLocations: () => void
    onFinalize: () => void
    onRun: () => void
    onCancel: () => void
    onClone: () => void
    onNewNode: () => void
    onOpenSettings: () => void
}) {
    const [open, setOpen] = useState(false)
    const locked = session?.finalized ?? false
    const runnable = locked && !session?.started
    const cancellable = session ? isCancellable(session) : false

    const close = (action: () => void) => () => {
        setOpen(false)
        action()
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Session menu" className="lg:hidden">
                    <Menu />
                </Button>
            </SheetTrigger>

            <SheetContent side="left" className="gap-0">
                <SheetHeader className="h-14 shrink-0 justify-center border-b border-border px-4 py-0">
                    <SheetTitle className="micro-label">Menu</SheetTitle>
                    <SheetDescription className="sr-only">
                        Directories, progress and actions for this session.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-2">
                    {session && (
                        <>
                            <SessionLocations session={session} onEdit={close(onEditLocations)} />
                            <SessionProgress session={session} />

                            <span className="my-1 h-px shrink-0 bg-border" />

                            {!locked && (
                                <MenuAction
                                    label="New node"
                                    icon={Plus}
                                    onClick={close(onNewNode)}
                                />
                            )}
                            <MenuAction label="Duplicate" icon={Copy} onClick={close(onClone)} />
                            {!locked && (
                                <MenuAction
                                    label="Finalize"
                                    icon={Lock}
                                    onClick={close(onFinalize)}
                                />
                            )}
                            {runnable && (
                                <MenuAction label="Run" icon={Play} onClick={close(onRun)} />
                            )}
                            {cancellable && (
                                <MenuAction
                                    label="Cancel run"
                                    icon={CircleStop}
                                    onClick={close(onCancel)}
                                />
                            )}

                            <span className="my-1 h-px shrink-0 bg-border" />
                        </>
                    )}

                    <MenuAction label="Settings" icon={Settings} onClick={close(onOpenSettings)} />
                </div>
            </SheetContent>
        </Sheet>
    )
}

function MenuAction({
    label,
    icon: Icon,
    onClick,
}: {
    label: string
    icon: ComponentType<{className?: string}>
    onClick: () => void
}) {
    return (
        <Button variant="ghost" className="w-full justify-start" onClick={onClick}>
            <Icon />
            {label}
        </Button>
    )
}

function SessionLocations({session, onEdit}: {session: Session; onEdit: () => void}) {
    const paths = [session.workingDir, session.contextDir].filter(Boolean)
    if (paths.length === 0) return null

    const body = (
        <>
            <span className="micro-label">Directories</span>
            {paths.map((path) => (
                <span key={path} className="truncate font-mono text-sm text-muted-foreground">
                    {path}
                </span>
            ))}
        </>
    )

    if (session.finalized) return <span className="flex flex-col gap-2 px-3 py-2">{body}</span>

    return (
        <button
            type="button"
            onClick={onEdit}
            className="flex flex-col gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {body}
        </button>
    )
}

function SessionProgress({session}: {session: Session}) {
    const {done, total} = sessionProgress(session)

    return (
        <span className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="micro-label">Progress</span>
            <span className="font-mono text-sm text-muted-foreground">
                {done}/{total}
            </span>
        </span>
    )
}
