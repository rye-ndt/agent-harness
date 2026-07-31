import {Boxes, Plus} from 'lucide-react'

import {SessionRow} from '@/components/sessions/session-row'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import type {Session} from '@/types/session'

export function SessionsRail({
    sessions,
    activeSessionId,
    onSelect,
    onCreate,
    onClone,
    onDelete,
    onOpenAgents,
}: {
    sessions: Session[]
    activeSessionId: string | null
    onSelect: (sessionId: string) => void
    onCreate: () => void
    onClone: (sessionId: string) => void
    onDelete: (sessionId: string) => void
    onOpenAgents: () => void
}) {
    return (
        <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-sidebar">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border pr-2 pl-3">
                <span className="micro-label">Sessions</span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="New session"
                            onClick={onCreate}
                            className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                        >
                            <Plus />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">New session</TooltipContent>
                </Tooltip>
            </div>

            {sessions.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
                    <p className="text-[0.8125rem] text-muted-foreground">No sessions yet.</p>
                    <button
                        type="button"
                        onClick={onCreate}
                        className="rounded-md text-[0.8125rem] font-medium underline underline-offset-4 outline-none hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        Create your first session
                    </button>
                </div>
            ) : (
                <ScrollArea className="min-h-0 flex-1">
                    <div className="flex flex-col gap-0.5 p-2">
                        {sessions.map((session) => (
                            <SessionRow
                                key={session.id}
                                session={session}
                                active={session.id === activeSessionId}
                                onSelect={() => onSelect(session.id)}
                                onClone={() => onClone(session.id)}
                                onDelete={() => onDelete(session.id)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

            <div className="shrink-0 border-t border-border p-2">
                <Button
                    variant="ghost"
                    onClick={onOpenAgents}
                    className="w-full justify-start gap-2 text-[0.8125rem] hover:bg-sidebar-accent"
                >
                    <Boxes />
                    Agents
                </Button>
                <p className="micro-label mt-2 px-2.5">Shared by every session.</p>
            </div>
        </aside>
    )
}
