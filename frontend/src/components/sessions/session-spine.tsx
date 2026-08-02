import {cn} from '@/lib/utils'
import {taskLayers} from '@/lib/session'
import type {Session, Task, TaskState} from '@/types/session'

const MAX_LAYERS = 6
const MAX_DOTS_PER_LAYER = 3

const SPINE_DOT_CLASSES: Record<TaskState, string> = {
    idle: 'bg-state-idle/40',
    blocked: 'bg-state-idle/40',
    queued: 'bg-state-idle/40',
    running: 'bg-state-running',
    awaiting_approval: 'bg-state-approval',
    done: 'bg-state-done',
    failed: 'bg-state-failed',
}

function groupByLayer(session: Session) {
    const layers = taskLayers(session)
    const grouped = new Map<number, Task[]>()

    for (const task of session.tasks) {
        const index = layers.get(task.id) ?? 0
        const bucket = grouped.get(index)
        if (bucket) bucket.push(task)
        else grouped.set(index, [task])
    }

    return [...grouped.entries()].sort(([a], [b]) => a - b).map(([, tasks]) => tasks)
}

function SpineDot({state}: {state: TaskState}) {
    return (
        <span className="relative flex size-[5px]">
            {state === 'running' && (
                <span className="absolute -inset-[3px] animate-ping rounded-full bg-state-running/40 motion-reduce:hidden" />
            )}
            <span className={cn('size-[5px] rounded-full', SPINE_DOT_CLASSES[state])} />
        </span>
    )
}

function Overflow({count}: {count: number}) {
    return <span className="font-mono text-xs leading-none text-muted-foreground">+{count}</span>
}

export function SessionSpine({session}: {session: Session}) {
    if (session.tasks.length === 0) {
        return (
            <div className="flex h-3.5 items-center" aria-hidden>
                <span className="h-px w-4 bg-border" />
            </div>
        )
    }

    const layers = groupByLayer(session)
    const overflowing = layers.length > MAX_LAYERS
    const shown = overflowing ? layers.slice(0, MAX_LAYERS - 1) : layers

    return (
        <div className="pointer-events-none flex h-3.5 items-center" aria-hidden>
            {shown.map((tasks, index) => (
                <div key={index} className="flex shrink-0 items-center">
                    {index > 0 && <span className="h-px w-2 shrink-0 bg-border" />}
                    <div className="flex shrink-0 flex-col items-center gap-[3px]">
                        {tasks.slice(0, MAX_DOTS_PER_LAYER).map((task) => (
                            <SpineDot key={task.id} state={task.state} />
                        ))}
                        {tasks.length > MAX_DOTS_PER_LAYER && (
                            <Overflow count={tasks.length - MAX_DOTS_PER_LAYER} />
                        )}
                    </div>
                </div>
            ))}
            {overflowing && (
                <>
                    <span className="h-px w-2 shrink-0 bg-border" />
                    <Overflow count={layers.length - shown.length} />
                </>
            )}
        </div>
    )
}
