import {useState} from 'react'

import {AGENT_OPTIONS, installAgentChoice} from '@/api/onboarding'
import {StateIcon} from '@/components/common/task-state'
import {TaskState} from '@/lib/enums'
import {cn} from '@/lib/utils'
import type {AgentOption} from '@/types/agent'

export function AgentChoice({onInstalled}: {onInstalled: () => void}) {
    const [installingId, setInstallingId] = useState('')
    const [error, setError] = useState('')

    const busy = installingId !== ''

    const choose = async (option: AgentOption) => {
        setError('')
        setInstallingId(option.id)

        if (await installAgentChoice(option.id)) {
            onInstalled()
            return
        }

        setInstallingId('')
        setError(`${option.name} did not install. Try again, or pick the other agent.`)
    }

    return (
        <div className="flex flex-col gap-2">
            {AGENT_OPTIONS.map((option) => (
                <AgentOptionButton
                    key={option.id}
                    option={option}
                    busy={busy}
                    installing={installingId === option.id}
                    onChoose={choose}
                />
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}

function AgentOptionButton({
    option,
    busy,
    installing,
    onChoose,
}: {
    option: AgentOption
    busy: boolean
    installing: boolean
    onChoose: (option: AgentOption) => void
}) {
    const choose = () => onChoose(option)

    return (
        <button
            type="button"
            disabled={busy}
            onClick={choose}
            className={cn(
                'flex w-full items-center gap-3 rounded-lg p-3 text-left ring-1 ring-border transition-colors hover:bg-accent disabled:pointer-events-none',
                busy && !installing && 'opacity-50',
            )}
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{option.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{option.blurb}</span>
            </span>

            {installing && (
                <span className="flex shrink-0 items-center gap-2">
                    <StateIcon state={TaskState.Running} />
                    <span className="font-mono text-xs text-muted-foreground">Installing</span>
                </span>
            )}
        </button>
    )
}
