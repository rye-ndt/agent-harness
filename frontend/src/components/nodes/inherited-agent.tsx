import {SlidersHorizontal} from 'lucide-react'

import {useAgentDefaults} from '@/hooks/use-agent-defaults'
import {agentDefaultFor} from '@/lib/agent-default'
import {TASK_LEVEL_LABELS, THINKING_LEVEL_LABELS, type TaskLevel} from '@/lib/enums'

export function InheritedAgent({taskLevel}: {taskLevel: TaskLevel | undefined}) {
    const {defaults, loading} = useAgentDefaults()
    const agentDefault = agentDefaultFor(defaults, taskLevel)

    return (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <span className="micro-label">Agent</span>
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <SlidersHorizontal className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate font-mono text-base text-foreground">
                        {agentDefault
                            ? `${agentDefault.modelLabel} · ${THINKING_LEVEL_LABELS[agentDefault.thinkingLevel]}`
                            : loading
                              ? 'Reading preferences…'
                              : 'No default set'}
                    </span>
                </span>
            </div>
            <p className="text-sm text-muted-foreground">
                {taskLevel
                    ? `Inherited from the ${TASK_LEVEL_LABELS[taskLevel].toLowerCase()} task level. Change it under Settings → Preferences.`
                    : 'Set once this node has a template.'}
            </p>
        </div>
    )
}
