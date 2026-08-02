import type {AgentOption} from '@/types/agent'

const COMPLETED_KEY = 'harness.onboarding.completed'

const INSTALL_DELAY_MS = 900

export const AGENT_OPTIONS: AgentOption[] = [
    {id: 'claude_code', name: 'Claude Code', blurb: "Anthropic's terminal agent."},
    {id: 'codex', name: 'Codex', blurb: "OpenAI's terminal agent."},
]

export async function isOnboardingRequired(): Promise<boolean> {
    return localStorage.getItem(COMPLETED_KEY) !== 'true'
}

export async function completeOnboarding(): Promise<void> {
    localStorage.setItem(COMPLETED_KEY, 'true')
}

export async function installAgentChoice(agentId: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, INSTALL_DELAY_MS))
    return Boolean(agentId)
}
