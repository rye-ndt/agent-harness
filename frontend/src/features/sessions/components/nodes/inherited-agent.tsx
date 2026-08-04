import {SlidersHorizontal} from 'lucide-react'

import {TASK_LEVEL_LABELS, type TaskLevel} from '@/shared/lib/enums'

export function InheritedAgent({taskLevel}: {taskLevel: TaskLevel | undefined}) {
    return (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <span className="micro-label">Task level</span>
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <SlidersHorizontal className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate text-base text-foreground">
                        {taskLevel ? TASK_LEVEL_LABELS[taskLevel] : 'Not set'}
                    </span>
                </span>
            </div>
            <p className="text-sm text-muted-foreground">
                {taskLevel
                    ? 'Inherited from the template. Which agent runs this level is set under Settings → Preferences.'
                    : 'Set once this node has a template.'}
            </p>
        </div>
    )
}
