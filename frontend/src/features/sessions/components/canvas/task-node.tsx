import {Handle, Position, type Node, type NodeProps} from '@xyflow/react'

import {StateBadge, StateIcon} from '@/shared/components/task-state'
import {TaskLevelTag} from '@/shared/components/task-level-tag'
import {useElapsed} from '@/shared/hooks/use-elapsed'
import {TaskState, type TaskLevel} from '@/shared/lib/enums'
import {ContextStamina} from '@/features/sessions/components/canvas/context-stamina'
import {FailureBubble} from '@/features/sessions/components/canvas/failure-bubble'
import {TaskActivity} from '@/features/sessions/components/canvas/task-activity'
import {upstreamOf} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Session, Task} from '@/features/sessions/types'

export type TaskNodeData = {
    task: Task
    session: Session
    unlinkable: boolean
    needsInput: boolean
    taskLevel: TaskLevel | null
}

export type TaskNodeType = Node<TaskNodeData, 'task'>

const UNTITLED = 'Untitled task'

const TITLE_CLASSES: Record<TaskState, string> = {
    [TaskState.Idle]: 'text-state-approval',
    [TaskState.Blocked]: 'text-state-approval',
    [TaskState.Queued]: 'text-state-approval',
    [TaskState.AwaitingApproval]: 'text-state-approval',
    [TaskState.AwaitingAccept]: 'text-state-approval',
    [TaskState.Running]: 'text-info',
    [TaskState.Done]: 'text-state-done',
    [TaskState.Failed]: 'text-state-failed',
    [TaskState.Cancelled]: 'text-muted-foreground',
}

function accentClass(state: TaskState) {
    if (state === TaskState.Running) return 'bg-live'
    if (state === TaskState.Cancelled) return 'bg-state-idle'
    if (state === TaskState.AwaitingApproval) return 'bg-state-approval'
    return null
}

function failureTldr(task: Task) {
    if (task.state !== TaskState.Failed) return ''
    return task.report?.handoverDocs.at(-1)?.tldr ?? ''
}

function upstreamLine(upstream: Task[]) {
    if (upstream.length === 1) return `Runs after ${upstream[0].title || UNTITLED}`
    return `Runs after all ${upstream.length} upstream tasks`
}

function NeedsInputsChip() {
    return (
        <span className="inline-flex shrink-0 items-center rounded-sm bg-state-approval-tint px-2 py-1 text-xs leading-none font-bold tracking-[0.05em] text-state-approval uppercase">
            Inputs
        </span>
    )
}

export function TaskNode({data, selected}: NodeProps<TaskNodeType>) {
    const {task, session, unlinkable, needsInput, taskLevel} = data
    const elapsed = useElapsed(task.run?.startedAt, task.run?.finishedAt)

    const upstream = upstreamOf(session, task)
    const context = task.run?.context

    const blocked = task.state === TaskState.Blocked
    const running = task.state === TaskState.Running
    const cancelled = task.state === TaskState.Cancelled
    const connectable = !session.finalized && !unlinkable
    const accent = accentClass(task.state)
    const tldr = failureTldr(task)

    return (
        <div
            className={cn(
                'relative w-[260px] rounded-xl bg-card p-3 shadow-[0_2px_16px_rgba(27,28,30,0.04)] transition-all duration-120',
                blocked
                    ? 'border border-dashed border-border opacity-60 ring-0'
                    : 'ring-1 ring-border',
                running && 'bg-live-tint ring-1 ring-live',
                cancelled && 'bg-state-idle-tint ring-1 ring-state-idle/30',
                selected && 'ring-2 ring-live',
                unlinkable && 'opacity-30',
            )}
        >
            {tldr && <FailureBubble tldr={tldr} />}

            {running && <TaskActivity taskId={task.id} />}

            {accent && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                    <span className={cn('absolute inset-y-0 left-0 w-1', accent)} />
                </span>
            )}

            <Handle type="target" position={Position.Left} isConnectable={connectable} />

            <div className="relative flex items-center gap-2">
                <StateIcon state={task.state} />
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate text-lg font-medium',
                        TITLE_CLASSES[task.state],
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
                <span className="flex min-w-0 items-center gap-2">
                    {taskLevel && <TaskLevelTag taskLevel={taskLevel} />}
                    {needsInput && <NeedsInputsChip />}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    {context && <ContextStamina used={context.used} total={context.total} />}
                    <StateBadge state={task.state} />
                </span>
            </div>

            {upstream.length > 0 && (
                <p className="relative mt-1 truncate text-sm text-muted-foreground">
                    {upstreamLine(upstream)}
                </p>
            )}

            <Handle type="source" position={Position.Right} isConnectable={connectable} />
        </div>
    )
}
