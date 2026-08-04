import {Handle, Position, type Node, type NodeProps} from '@xyflow/react'

import {StateBadge, StateIcon} from '@/shared/components/task-state'
import {useElapsed} from '@/shared/hooks/use-elapsed'
import {TaskState} from '@/shared/lib/enums'
import {clampRatio, formatTokens} from '@/shared/lib/format'
import {upstreamOf} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Session, Task} from '@/features/sessions/types'

export type TaskNodeAgent = {
    model: string
    effort: string
}

export type TaskNodeData = {
    task: Task
    session: Session
    unlinkable: boolean
    agent: TaskNodeAgent | null
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

const UNTITLED = 'Untitled task'

function meterClass(ratio: number) {
    if (ratio < 0.7) return 'bg-live'
    if (ratio < 0.9) return 'bg-state-approval'
    return 'bg-state-failed'
}

function upstreamLine(upstream: Task[]) {
    if (upstream.length === 1) return `Runs after ${upstream[0].title || UNTITLED}`
    return `Runs after all ${upstream.length} upstream tasks`
}

export function TaskNode({data, selected}: NodeProps<TaskNodeType>) {
    const {task, session, unlinkable, agent} = data
    const elapsed = useElapsed(task.run?.startedAt, task.run?.finishedAt)

    const upstream = upstreamOf(session, task)
    const context = task.run?.context
    const ratio = context && context.total > 0 ? clampRatio(context.used / context.total) : 0

    const blocked = task.state === TaskState.Blocked
    const running = task.state === TaskState.Running
    const connectable = !session.finalized && !unlinkable

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

            {task.state === TaskState.AwaitingApproval && (
                <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-lg bg-state-approval" />
            )}

            <Handle type="target" position={Position.Left} isConnectable={connectable} />

            <div className="relative flex items-center gap-2">
                <StateIcon state={task.state} />
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate text-lg font-medium',
                        !task.title && 'text-muted-foreground',
                    )}
                >
                    {task.title || UNTITLED}
                </span>
                {elapsed && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {elapsed}
                    </span>
                )}
            </div>

            <div className="relative mt-2 flex items-center justify-between gap-2 text-sm">
                {agent && (
                    <span className="flex min-w-0 items-center gap-1 font-mono text-muted-foreground">
                        <span className="truncate">{agent.model}</span>
                        <span className="shrink-0">· {agent.effort}</span>
                    </span>
                )}
                <span className="flex shrink-0 items-center gap-2">
                    {context && (
                        <span className="font-mono text-xs text-muted-foreground">
                            {formatTokens(context.used)}/{formatTokens(context.total)}
                        </span>
                    )}
                    <StateBadge state={task.state} />
                </span>
            </div>

            {upstream.length > 0 && (
                <p className="relative mt-1 truncate text-sm text-muted-foreground">
                    {upstreamLine(upstream)}
                </p>
            )}

            {context && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-b-lg bg-border">
                    <span
                        className={cn('block h-full rounded-bl-lg', meterClass(ratio))}
                        style={{width: `${ratio * 100}%`}}
                    />
                </span>
            )}

            <Handle type="source" position={Position.Right} isConnectable={connectable} />
        </div>
    )
}
