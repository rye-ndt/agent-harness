import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    TASK_LEVEL_LABELS,
    TASK_LEVELS,
    THINKING_LEVEL_LABELS,
    type ThinkingLevel,
} from '@/lib/enums'
import {taskLevelWeight} from '@/lib/agent-default'
import {cn} from '@/lib/utils'
import type {AgentDefault, AgentDefaultOptions} from '@/types/settings'

export const MODEL_COLUMN = 'w-[148px]'
export const EFFORT_COLUMN = 'w-[116px]'

export function AgentDefaultRow({
    agentDefault,
    options,
    saving,
    onChangeModel,
    onChangeThinkingLevel,
}: {
    agentDefault: AgentDefault
    options: AgentDefaultOptions
    saving: boolean
    onChangeModel: (model: string) => void
    onChangeThinkingLevel: (thinkingLevel: ThinkingLevel) => void
}) {
    const {taskLevel} = agentDefault
    const label = TASK_LEVEL_LABELS[taskLevel]

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-base font-medium">{label}</span>
                <LevelWeight weight={taskLevelWeight(taskLevel)} />
            </span>

            <Select value={agentDefault.model} disabled={saving} onValueChange={onChangeModel}>
                <SelectTrigger className={cn('shrink-0', MODEL_COLUMN)} aria-label={`${label} model`}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.models.map((option) => (
                        <SelectItem key={option.model} value={option.model}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={agentDefault.thinkingLevel}
                disabled={saving}
                onValueChange={onChangeThinkingLevel}
            >
                <SelectTrigger
                    className={cn('shrink-0', EFFORT_COLUMN)}
                    aria-label={`${label} effort`}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.thinkingLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                            {THINKING_LEVEL_LABELS[level]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

/** Four rungs, filled up to this level's place on the ladder. */
function LevelWeight({weight}: {weight: number}) {
    return (
        <span className="flex shrink-0 items-end gap-0.75" aria-hidden="true">
            {TASK_LEVELS.map((level, index) => (
                <span
                    key={level}
                    className={cn(
                        'h-2.5 w-0.75 rounded-full',
                        index < weight ? 'bg-foreground/60' : 'bg-border',
                    )}
                />
            ))}
        </span>
    )
}
