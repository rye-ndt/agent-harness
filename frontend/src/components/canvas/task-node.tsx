import {Handle, Position, type Node, type NodeProps} from '@xyflow/react'

import {StateBadge, StateIcon} from '@/components/common/task-state'
import {useElapsed} from '@/hooks/use-elapsed'
import {upstreamOf} from '@/lib/session'
import {cn} from '@/lib/utils'
import type {Session, Task} from '@/types/session'

export type TaskNodeData = {
    task: Task
    session: Session
    unlinkable: boolean
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

function formatTokens(value: number) {
    if (value < 1000) return String(value)
    const thousands = value / 1000
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`
}

function meterClass(ratio: number) {
    if (ratio < 0.7) return 'bg-live'
    if (ratio < 0.9) return 'bg-state-approval'
    return 'bg-state-failed'
}

export function TaskNode({data, selected}: NodeProps<TaskNodeType>) {
    const {task, session, unlinkable} = data
    const upstream = upstreamOf(session, task)
    const context = task.run?.context
    const ratio = context && context.total > 0 ? context.used / context.total : 0
    const blocked = task.state === 'blocked'
    const running = task.state === 'running'
    const elapsed = useElapsed(task.run?.startedAt, task.run?.finishedAt)

    return (
        <div
            className={cn(
                'relative w-[260px] rounded-lg bg-background p-3 shadow-sm transition-all duration-120',
                blocked
                    ? 'border border-dashed border-border opacity-60 ring-0'
                    : 'ring-1 ring-border',
                running && 'ring-1 ring-live',
                selected && 'ring-2 ring-live',
                unlinkable && 'opacity-30',
            )}
        >
            {running && (
                <span className="pointer-events-none absolute inset-0 rounded-lg bg-live-tint/60" />
            )}

            {task.state === 'awaiting_approval' && (
                <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-lg bg-state-approval" />
            )}

            <Handle
                type="target"
                position={Position.Left}
                isConnectable={!session.finalized && !unlinkable}
            />

            <div className="relative flex items-center gap-2">
                <StateIcon state={task.state} />
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate text-[0.9375rem] font-medium',
                        !task.title && 'text-muted-foreground',
                    )}
                >
                    {task.title || 'Untitled task'}
                </span>
                {elapsed && (
                    <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                        {elapsed}
                    </span>
                )}
            </div>

            <div className="relative mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-mono text-muted-foreground">{task.agent}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                    {context && (
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                            {formatTokens(context.used)}/{formatTokens(context.total)}
                        </span>
                    )}
                    <StateBadge state={task.state} />
                </span>
            </div>

            {upstream.length > 0 && (
                <p className="relative mt-1.5 truncate text-xs text-muted-foreground">
                    {upstream.length === 1
                        ? `Runs after ${upstream[0].title || 'Untitled task'}`
                        : `Runs after all ${upstream.length} upstream tasks`}
                </p>
            )}

            {context && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-b-lg bg-border">
                    <span
                        className={cn('block h-full rounded-bl-lg', meterClass(ratio))}
                        style={{width: `${Math.min(100, Math.max(0, ratio * 100))}%`}}
                    />
                </span>
            )}

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={!session.finalized && !unlinkable}
            />
        </div>
    )
}
