import {TaskLevel, ThinkingLevel} from '@/shared/lib/enums'
import type {AgentDefault, AgentDefaultOptions} from '@/features/settings/types'

export const MOCK_AUTOPILOT = false

export const MOCK_MODEL_OPTIONS = [
    {model: 'fable', label: 'Claude Fable', harness: 'claude_code'},
    {model: 'opus', label: 'Claude Opus', harness: 'claude_code'},
    {model: 'sonnet', label: 'Claude Sonnet', harness: 'claude_code'},
    {model: 'haiku', label: 'Claude Haiku', harness: 'claude_code'},
    {
        model: 'opencode/deepseek-v4-flash-free',
        label: 'Deepseek V4 Flash',
        harness: 'open_code',
    },
]

export const MOCK_AGENT_DEFAULT_OPTIONS: AgentDefaultOptions = {
    taskLevels: [TaskLevel.Lightweight, TaskLevel.Daily, TaskLevel.Heavy, TaskLevel.MaximumEffort],
    models: MOCK_MODEL_OPTIONS,
    thinkingLevels: [
        ThinkingLevel.Low,
        ThinkingLevel.Medium,
        ThinkingLevel.High,
        ThinkingLevel.XHigh,
        ThinkingLevel.Max,
    ],
}

export const MOCK_AGENT_DEFAULTS: AgentDefault[] = [
    {
        taskLevel: TaskLevel.Lightweight,
        model: 'haiku',
        modelLabel: 'Claude Haiku',
        thinkingLevel: ThinkingLevel.Low,
    },
    {
        taskLevel: TaskLevel.Daily,
        model: 'sonnet',
        modelLabel: 'Claude Sonnet',
        thinkingLevel: ThinkingLevel.Medium,
    },
    {
        taskLevel: TaskLevel.Heavy,
        model: 'opus',
        modelLabel: 'Claude Opus',
        thinkingLevel: ThinkingLevel.High,
    },
    {
        taskLevel: TaskLevel.MaximumEffort,
        model: 'opus',
        modelLabel: 'Claude Opus',
        thinkingLevel: ThinkingLevel.Max,
    },
]
