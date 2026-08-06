import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {installAgent, listAgents, onInstallProgress} from '@/features/agents/api'
import {completeOnboarding, hasOnboarded} from '@/features/onboarding/api'
import {InstallStage} from '@/shared/lib/enums'
import {reportError} from '@/shared/lib/error-bus'
import {overallRatio} from '@/features/onboarding/install'
import type {Agent, Dependency, InstallProgress} from '@/features/agents/types'

const AGENTS_KEY = ['agents']
const ONBOARDED_KEY = ['onboarded']

export function useDependencies() {
    const queryClient = useQueryClient()

    const {data, isPending} = useQuery({queryKey: AGENTS_KEY, queryFn: listAgents})
    const onboarding = useQuery({queryKey: ONBOARDED_KEY, queryFn: hasOnboarded})

    const [progress, setProgress] = useState<Record<string, InstallProgress>>({})
    const [installed, setInstalled] = useState<string[]>([])
    const [failedIds, setFailedIds] = useState<string[]>([])
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
            setNeeded(true)
            setRunning(true)
            setFailedIds([])
            setProgress((current) => {
                const next = {...current}
                for (const target of targets) delete next[target.id]
                return next
            })

            for (const target of targets) {
                try {
                    await installAgent(target.id)
                    setInstalled((current) => [...current, target.id])
                } catch (cause) {
                    reportError(cause, `Could not install ${target.name}`)
                    setFailedIds((current) => [...current, target.id])
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

    const finish = useCallback(() => {
        void completeOnboarding().catch(() => {})
        queryClient.setQueryData(ONBOARDED_KEY, true)
    }, [queryClient])

    useEffect(() => {
        if (started.current || isPending || onboarding.isPending) return

        started.current = true
        if (onboarding.data) return

        const missing = agents.filter((agent) => !agent.installed)
        if (missing.length === 0) {
            finish()
            return
        }

        setTimeout(() => void install(missing))
    }, [agents, isPending, onboarding.isPending, onboarding.data, install, finish])

    const dependencies: Dependency[] = agents.map((agent) => {
        const ready = !isMissing(agent)
        const update = progress[agent.id] ?? null

        return {
            id: agent.id,
            name: agent.name,
            version: agent.version,
            stage: ready ? InstallStage.Done : (update?.stage ?? InstallStage.Queued),
            progress: update,
            failed: failedIds.includes(agent.id),
        }
    })

    const anyReady = agents.some((agent) => !isMissing(agent))

    return {
        ready: !isPending && !onboarding.isPending,
        required: needed && !dismissed,
        settled: !running && failedIds.length === 0 && !agents.some(isMissing),
        canContinue: !running && anyReady,
        dependencies,
        ratio: overallRatio(dependencies),
        failed: failedIds.length > 0,
        retry: () => void install(agents.filter(isMissing)),
        dismiss: () => {
            setDismissed(true)
            finish()
        },
    }
}
