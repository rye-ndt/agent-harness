import {
    AgentDefaultRow,
    EFFORT_COLUMN,
    MODEL_COLUMN,
} from '@/features/settings/components/agent-default-row'
import {useAgentDefaults} from '@/features/settings/use-agent-defaults'
import type {ThinkingLevel} from '@/shared/lib/enums'
import {cn} from '@/shared/lib/utils'
import type {AgentDefault} from '@/features/settings/types'

export function PreferencesPanel() {
    const {defaults, options, loading, error, pendingTaskLevel, setAgentDefault} =
        useAgentDefaults()

    const changeModel = (agentDefault: AgentDefault) => (model: string) =>
        setAgentDefault({
            taskLevel: agentDefault.taskLevel,
            model,
            thinkingLevel: agentDefault.thinkingLevel,
        })

    const changeThinkingLevel = (agentDefault: AgentDefault) => (thinkingLevel: ThinkingLevel) =>
        setAgentDefault({
            taskLevel: agentDefault.taskLevel,
            model: agentDefault.model,
            thinkingLevel,
        })

    return (
        <section className="flex flex-col">
            <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
                <h3 className="text-lg font-medium">Model per task level</h3>
                <p className="text-sm text-muted-foreground">
                    Every node inherits its model and effort from its task level. Change a row and
                    every node at that level follows, including nodes you have already drawn.
                </p>
            </div>

            <div className="flex items-center gap-3 border-y border-border px-4 py-2">
                <span className="micro-label min-w-0 flex-1">Task level</span>
                <span className={cn('micro-label shrink-0', MODEL_COLUMN)}>Model</span>
                <span className={cn('micro-label shrink-0', EFFORT_COLUMN)}>Effort</span>
            </div>

            {loading || !options ? (
                <p className="px-4 py-3 text-base text-muted-foreground">Loading preferences…</p>
            ) : (
                <div className="divide-y divide-border">
                    {defaults.map((agentDefault) => (
                        <AgentDefaultRow
                            key={agentDefault.taskLevel}
                            agentDefault={agentDefault}
                            options={options}
                            saving={pendingTaskLevel === agentDefault.taskLevel}
                            onChangeModel={changeModel(agentDefault)}
                            onChangeThinkingLevel={changeThinkingLevel(agentDefault)}
                        />
                    ))}
                </div>
            )}

            {error && (
                <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            )}
        </section>
    )
}
