import {TASK_LEVELS, type TaskLevel} from '@/lib/enums'
import type {AgentDefault, ModelOption} from '@/types/settings'

/**
 * A node never stores a model. The Go side resolves one from the task level
 * when the session runs, so the frontend resolves the same way when it draws.
 */
export function agentDefaultFor(defaults: AgentDefault[], taskLevel: TaskLevel | undefined) {
    if (!taskLevel) return undefined
    return defaults.find((agentDefault) => agentDefault.taskLevel === taskLevel)
}

/** Where a level sits on the ladder, 1 for the lightest. */
export function taskLevelWeight(taskLevel: TaskLevel) {
    return TASK_LEVELS.indexOf(taskLevel) + 1
}

export type HarnessDemand = {
    harness: string
    modelLabels: string[]
}

/**
 * Which harnesses the current preferences commit the user to, and the models
 * that pull each one in. A session cannot start until every one of these is
 * installed and logged in, because any task level may be used once nodes exist.
 */
export function requiredHarnesses(
    defaults: AgentDefault[],
    models: ModelOption[],
): HarnessDemand[] {
    const harnessOf = new Map(models.map((option) => [option.model, option.harness]))
    const demands = new Map<string, string[]>()

    for (const agentDefault of defaults) {
        const harness = harnessOf.get(agentDefault.model)
        if (!harness) continue

        const labels = demands.get(harness) ?? []
        if (!labels.includes(agentDefault.modelLabel)) labels.push(agentDefault.modelLabel)
        demands.set(harness, labels)
    }

    return [...demands].map(([harness, modelLabels]) => ({harness, modelLabels}))
}
