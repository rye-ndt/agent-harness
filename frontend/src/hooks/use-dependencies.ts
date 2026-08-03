import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {installAgent, listAgents, onInstallProgress} from '@/api/agents'
import {InstallStage} from '@/lib/enums'
import {errorMessage} from '@/lib/errors'
import {overallRatio} from '@/lib/install'
import type {Agent, Dependency, InstallProgress} from '@/types/agent'

const AGENTS_KEY = ['agents']

type Failure = {agentId: string; message: string}

export function useDependencies() {
    const queryClient = useQueryClient()

    const {data, isPending} = useQuery({queryKey: AGENTS_KEY, queryFn: listAgents})

    const [progress, setProgress] = useState<Record<string, InstallProgress>>({})
    const [installed, setInstalled] = useState<string[]>([])
    const [failure, setFailure] = useState<Failure | null>(null)
    const [running, setRunning] = useState(false)
    const [needed, setNeeded] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    const started = useRef(false)

    const agents = useMemo(() => data ?? [], [data])

    useEffect(
        () =>
            onInstallProgress((agentId, update) => {
                setProgress((current) => ({...current, [agentId]: update}))
            }),
        [],
    )

    const install = useCallback(
        async (targets: Agent[]) => {
            setRunning(true)
            setFailure(null)
            setProgress((current) => {
                const next = {...current}
                for (const target of targets) delete next[target.id]
                return next
            })

            for (const target of targets) {
                try {
                    await installAgent(target.id)
                    setInstalled((current) => [...current, target.id])
                } catch (error) {
                    setFailure({
                        agentId: target.id,
                        message:
                            errorMessage(error) ||
                            `${target.name} did not install. Check your connection and try again.`,
                    })
                    setRunning(false)
                    return
                }
            }

            setRunning(false)
            await queryClient.invalidateQueries({queryKey: AGENTS_KEY})
        },
        [queryClient],
    )

    const isMissing = useCallback(
        (agent: Agent) => !agent.installed && !installed.includes(agent.id),
        [installed],
    )

    useEffect(() => {
        if (started.current || isPending) return

        const missing = agents.filter((agent) => !agent.installed)
        if (missing.length === 0) return

        started.current = true
        setNeeded(true)
        void install(missing)
    }, [agents, isPending, install])

    const dependencies: Dependency[] = agents.map((agent) => {
        const ready = !isMissing(agent)
        const update = progress[agent.id] ?? null

        return {
            id: agent.id,
            name: agent.name,
            version: agent.version,
            stage: ready ? InstallStage.Done : (update?.stage ?? InstallStage.Queued),
            progress: update,
            failed: failure?.agentId === agent.id,
        }
    })

    return {
        ready: !isPending,
        required: needed && !dismissed,
        settled: !running && !failure && !agents.some(isMissing),
        dependencies,
        ratio: overallRatio(dependencies),
        error: failure?.message ?? '',
        retry: () => void install(agents.filter(isMissing)),
        dismiss: () => setDismissed(true),
    }
}
