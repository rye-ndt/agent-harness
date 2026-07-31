import {useEffect, useState} from 'react'
import {ChevronDown, X} from 'lucide-react'

import {StateBadge, StateDot, StateIcon} from '@/components/common/task-state'
import {ApprovalPanel} from '@/components/inspector/approval-panel'
import {ContextMeter} from '@/components/inspector/context-meter'
import {RunLog} from '@/components/inspector/run-log'
import {Button} from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Textarea} from '@/components/ui/textarea'
import {downstreamOf, STATE_LABELS, upstreamOf} from '@/lib/session'
import type {Session, Task} from '@/types/session'

const AGENTS = ['claude_code', 'opencode', 'codex']

function Section({label, children}: {label: string; children: React.ReactNode}) {
    return (
        <section className="flex flex-col gap-2 px-4 py-3">
            <p className="micro-label">{label}</p>
            {children}
        </section>
    )
}

function TaskRow({task}: {task: Task}) {
    return (
        <div className="flex items-center gap-2">
            <StateDot state={task.state} />
            <span className="truncate text-xs">{task.title}</span>
        </div>
    )
}

export function TaskInspector({
    session,
    task,
    onChange,
    onRemove,
    onClose,
}: {
    session: Session
    task: Task
    onChange: (patch: Partial<Task>) => void
    onRemove: () => void
    onClose: () => void
}) {
    const [title, setTitle] = useState(task.title)

    useEffect(() => {
        setTitle(task.title)
    }, [task.id, task.title])

    const locked = session.finalized
    const upstream = upstreamOf(session, task)
    const downstream = downstreamOf(session, task)

    const commitTitle = () => {
        const next = title.trim()
        if (!next || next === task.title) {
            setTitle(task.title)
            return
        }
        onChange({title: next})
    }

    return (
        <aside className="flex h-full w-[380px] shrink-0 animate-in flex-col border-r border-border bg-sidebar duration-180 fade-in slide-in-from-left-2 motion-reduce:animate-none">
            <div className="flex items-start gap-2 px-4 py-3">
                <StateIcon state={task.state} className="mt-1" />
                <input
                    value={title}
                    disabled={locked}
                    aria-label="Task title"
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') setTitle(task.title)
                    }}
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[0.9375rem] font-medium outline-none transition-colors duration-120 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
                />
                <Button variant="ghost" size="icon-sm" aria-label="Close inspector" onClick={onClose}>
                    <X />
                </Button>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto border-t border-border">
                <Section label="Status">
                    <div className="flex items-center gap-2">
                        <StateBadge state={task.state} />
                        <span className="text-xs text-muted-foreground">
                            {STATE_LABELS[task.state]}
                        </span>
                    </div>
                    {task.state === 'blocked' && upstream.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Waiting on {upstream.map((t) => t.title).join(', ')}
                        </p>
                    )}
                    {task.state === 'queued' && (
                        <p className="text-xs text-muted-foreground">
                            Runs when you start the session.
                        </p>
                    )}
                </Section>

                <Section label="Agent">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={locked}
                            className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 font-mono text-[0.8125rem] transition-colors duration-120 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {task.agent}
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {AGENTS.map((agent) => (
                                <DropdownMenuItem
                                    key={agent}
                                    className="font-mono text-[0.8125rem]"
                                    onSelect={() => onChange({agent})}
                                >
                                    {agent}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Section>

                <Section label="Prompt">
                    <Textarea
                        value={task.prompt}
                        disabled={locked}
                        placeholder="What should this agent do? Be specific about scope and what to report back."
                        onChange={(event) => onChange({prompt: event.target.value})}
                        className="min-h-[120px] bg-background text-[0.8125rem]"
                    />
                </Section>

                <Section label="Depends on">
                    {upstream.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Nothing. This task starts the chain.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {upstream.map((t) => (
                                <TaskRow key={t.id} task={t} />
                            ))}
                            {upstream.length > 1 && (
                                <p className="text-xs text-muted-foreground">
                                    Runs when all {upstream.length} finish.
                                </p>
                            )}
                        </div>
                    )}

                    {downstream.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                            <p className="micro-label">Feeds into</p>
                            <div className="flex flex-col gap-1.5">
                                {downstream.map((t) => (
                                    <TaskRow key={t.id} task={t} />
                                ))}
                            </div>
                        </div>
                    )}
                </Section>

                {task.approval && (
                    <Section label="Approval">
                        <ApprovalPanel
                            approval={task.approval}
                            onAnswer={() => onChange({approval: undefined})}
                        />
                    </Section>
                )}

                {task.run?.context && (
                    <Section label="Context">
                        <ContextMeter
                            used={task.run.context.used}
                            total={task.run.context.total}
                        />
                    </Section>
                )}

                {task.run && (
                    <Section label="Run">
                        <RunLog run={task.run} />
                    </Section>
                )}

            </div>

            {!locked && (
                <div className="border-t border-border px-4 pt-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onRemove}
                    >
                        Delete task
                    </Button>
                </div>
            )}

            <p className="truncate px-4 pt-2 pb-3 font-mono text-[0.6875rem] text-muted-foreground">
                {task.id}
            </p>
        </aside>
    )
}
