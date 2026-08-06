import {useEffect, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/agents/api'
import {formatAgentName} from '@/shared/lib/format'
import type {InstallProgress} from '@/features/agents/types'

const AGENTS_KEY = ['agents']

const AUTH_POLL_MS = 2000

type AgentAction = {
    agentId: string
    label: string
    action: string
    run: () => Promise<void>
}

function withoutKey(record: Record<string, string>, key: string) {
    const next = {...record}
    delete next[key]
    return next
}

function progressLabel(progress: InstallProgress) {
    const downloading = progress.stage === 'download' && progress.total > 0
    if (!downloading) return progress.stage

    return `Downloading ${Math.round((progress.downloaded / progress.total) * 100)}%`
}

export function useAgents() {
    const queryClient = useQueryClient()
    const [authUrls, setAuthUrls] = useState<Record<string, string>>({})
    const [progress, setProgress] = useState<Record<string, string>>({})

    const agentsQuery = useQuery({
        queryKey: AGENTS_KEY,
        queryFn: api.listAgents,
        meta: {action: 'Could not load the agents'},
        refetchInterval: (query) => {
            const awaitingLogin = query.state.data?.some(
                (agent) => Boolean(authUrls[agent.id]) && !agent.loggedIn,
            )
            return awaitingLogin ? AUTH_POLL_MS : false
        },
        refetchIntervalInBackground: true,
    })

    const action = useMutation({
        mutationFn: (input: AgentAction) => input.run(),
        onSettled: (_data, _error, input) => {
            setProgress((current) => withoutKey(current, input.agentId))
            queryClient.invalidateQueries({queryKey: AGENTS_KEY})
        },
    })

    useEffect(
        () =>
            api.onInstallProgress((agentId, update) => {
                setProgress((current) => ({...current, [agentId]: progressLabel(update)}))
            }),
        [],
    )

    const pending = action.isPending ? action.variables : null

    const busyLabel = (agentId: string) => {
        if (pending?.agentId !== agentId) return null
        return progress[agentId] ?? pending.label
    }

    const install = (agentId: string) =>
        action.mutate({
            agentId,
            label: 'Installing',
            action: `Could not install ${formatAgentName(agentId)}`,
            run: () => api.installAgent(agentId),
        })

    const uninstall = (agentId: string) =>
        action.mutate({
            agentId,
            label: 'Uninstalling',
            action: `Could not uninstall ${formatAgentName(agentId)}`,
            run: () => api.uninstallAgent(agentId),
        })

    const logIn = (agentId: string) =>
        action.mutate({
            agentId,
            label: 'Logging in',
            action: `Could not start the login for ${formatAgentName(agentId)}`,
            run: async () => {
                const url = await api.startAgentLogin(agentId)
                if (url) setAuthUrls((current) => ({...current, [agentId]: url}))
            },
        })

    const submitAuthCode = (agentId: string, code: string) =>
        action.mutate({
            agentId,
            label: 'Verifying',
            action: `Could not verify that code for ${formatAgentName(agentId)}`,
            run: async () => {
                await api.submitAgentAuthCode(agentId, code)
                setAuthUrls((current) => withoutKey(current, agentId))
            },
        })

    const agents = agentsQuery.data ?? []

    return {
        agents,
        loading: agentsQuery.isPending,
        busy: pending !== null,
        busyLabel,
        authUrlOf: (agentId: string) => authUrls[agentId] ?? null,
        install,
        uninstall,
        logIn,
        submitAuthCode,
        openAuthUrl: api.openExternalURL,
    }
}
