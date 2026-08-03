/**
 * The only place the generated Wails bindings for agent defaults are touched.
 * Inside the webview the defaults and the models they can pick from come from
 * the Go user config. Under the plain vite dev server there is no Go side, so
 * the defaults live in this module's memory on top of src/lib/mock-preferences.ts.
 */

import {bridge, hasWailsRuntime} from '@/api/agents'
import {TASK_LEVELS, THINKING_LEVELS, type TaskLevel, type ThinkingLevel} from '@/lib/enums'
import {MOCK_AGENT_DEFAULT_OPTIONS, MOCK_AGENT_DEFAULTS} from '@/lib/mock-preferences'
import type {AgentDefault, AgentDefaultOptions} from '@/types/settings'
import {
    AgentDefaultOptions as FetchAgentDefaultOptions,
    AgentDefaults as FetchAgentDefaults,
    SetAgentDefault as SaveAgentDefault,
} from '../../wailsjs/go/wails_api/API'

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
    if (!hasWailsRuntime()) return structuredClone(defaults)

    const infos = await bridge(FetchAgentDefaults)
    const stored: AgentDefault[] = []

    for (const info of infos) {
        if (!isTaskLevel(info.task_level) || !isThinkingLevel(info.thinking_level)) continue

        stored.push({
            taskLevel: info.task_level,
            model: info.model,
            modelLabel: info.model_label,
            thinkingLevel: info.thinking_level,
        })
    }

    return stored
}

export async function agentDefaultOptions(): Promise<AgentDefaultOptions> {
    if (!hasWailsRuntime()) return structuredClone(MOCK_AGENT_DEFAULT_OPTIONS)

    const info = await bridge(FetchAgentDefaultOptions)

    return {
        taskLevels: (info.task_levels ?? []).filter(isTaskLevel),
        models: (info.models ?? []).map((model) => ({
            model: model.model,
            label: model.label,
            harness: model.harness,
        })),
        thinkingLevels: (info.thinking_levels ?? []).filter(isThinkingLevel),
    }
}

export async function setAgentDefault(
    taskLevel: string,
    model: string,
    thinkingLevel: string,
): Promise<void> {
    if (!isTaskLevel(taskLevel)) throw new Error(`${taskLevel} is not a task level.`)
    if (!isThinkingLevel(thinkingLevel)) throw new Error(`${thinkingLevel} is not an effort level.`)

    if (hasWailsRuntime()) {
        await bridge(() => SaveAgentDefault(taskLevel, model, thinkingLevel))
        return
    }

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
