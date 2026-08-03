/**
 * Stand-in for FEAPI.AgentDefaults / SetAgentDefault / AgentDefaultOptions,
 * which have no Wails binding yet. Defaults live in this module's memory and
 * the model label is derived here the way enums.ModelName.DisplayName() derives
 * it on the Go side. When the real bindings land, this is the only file that
 * changes.
 */

import {TASK_LEVELS, THINKING_LEVELS, type TaskLevel, type ThinkingLevel} from '@/lib/enums'
import {MOCK_AGENT_DEFAULT_OPTIONS, MOCK_AGENT_DEFAULTS} from '@/lib/mock-preferences'
import type {AgentDefault, AgentDefaultOptions} from '@/types/settings'

const ROUNDTRIP_MS = 400

let defaults: AgentDefault[] = structuredClone(MOCK_AGENT_DEFAULTS)

async function roundtrip() {
    await new Promise((resolve) => setTimeout(resolve, ROUNDTRIP_MS))
}

function modelLabel(model: string) {
    const option = MOCK_AGENT_DEFAULT_OPTIONS.models.find((candidate) => candidate.model === model)
    if (!option) throw new Error(`${model} is not a model this harness can run.`)
    return option.label
}

export async function listAgentDefaults(): Promise<AgentDefault[]> {
    return structuredClone(defaults)
}

export async function agentDefaultOptions(): Promise<AgentDefaultOptions> {
    return structuredClone(MOCK_AGENT_DEFAULT_OPTIONS)
}

export async function setAgentDefault(
    taskLevel: string,
    model: string,
    thinkingLevel: string,
): Promise<void> {
    if (!isTaskLevel(taskLevel)) throw new Error(`${taskLevel} is not a task level.`)
    if (!isThinkingLevel(thinkingLevel)) throw new Error(`${thinkingLevel} is not an effort level.`)

    const label = modelLabel(model)
    await roundtrip()

    defaults = defaults.map((current) =>
        current.taskLevel === taskLevel
            ? {...current, model, modelLabel: label, thinkingLevel}
            : current,
    )
}

function isTaskLevel(value: string): value is TaskLevel {
    return TASK_LEVELS.some((level) => level === value)
}

function isThinkingLevel(value: string): value is ThinkingLevel {
    return THINKING_LEVELS.some((level) => level === value)
}
