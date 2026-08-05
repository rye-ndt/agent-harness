import {TASK_LEVEL_LABELS, type TaskLevel} from '@/shared/lib/enums'
import {cn} from '@/shared/lib/utils'

export function TaskLevelTag({taskLevel, className}: {taskLevel: TaskLevel; className?: string}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded-sm border border-border-strong px-2 py-1 text-xs leading-none font-bold tracking-[0.05em] text-muted-foreground uppercase',
                className,
            )}
        >
            {TASK_LEVEL_LABELS[taskLevel]}
        </span>
    )
}
