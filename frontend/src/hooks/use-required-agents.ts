import {useAgentDefaults} from '@/hooks/use-agent-defaults'
import {useAgents} from '@/hooks/use-agents'
import {requiredHarnesses} from '@/lib/agent-default'
import type {Agent} from '@/types/agent'

export type RequiredAgent = {
    harness: string
    modelLabels: string[]
    agent: Agent | null
}

export function isAgentReady(required: RequiredAgent) {
    return Boolean(required.agent?.installed && required.agent.loggedIn)
}

/**
 * The agents the current preferences commit a session to. Every task level may
 * be used once the graph has nodes, so all four defaults count — not just the
 * ones a session happens to reach.
 */
export function useRequiredAgents() {
    const {defaults, options, loading: defaultsLoading} = useAgentDefaults()
    const roster = useAgents()

    const required: RequiredAgent[] = requiredHarnesses(defaults, options?.models ?? []).map(
        (demand) => ({
            ...demand,
            agent: roster.agents.find((agent) => agent.id === demand.harness) ?? null,
        }),
    )

    const loading = defaultsLoading || roster.loading
    const ready = !loading && required.length > 0 && required.every(isAgentReady)

    return {
        required,
        ready,
        loading,
        error: roster.error,
        busy: roster.busy,
        busyLabel: roster.busyLabel,
        authUrlOf: roster.authUrlOf,
        install: roster.install,
        logIn: roster.logIn,
        submitAuthCode: roster.submitAuthCode,
        openAuthUrl: roster.openAuthUrl,
    }
}
