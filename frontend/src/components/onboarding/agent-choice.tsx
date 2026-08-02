import {useState} from 'react'

import {AGENT_CHOICES, installAgent} from '@/api/onboarding'
import {StateIcon} from '@/components/common/task-state'
import {cn} from '@/lib/utils'

export function AgentChoice({onInstalled}: {onInstalled: () => void}) {
    const [installing, setInstalling] = useState('')
    const [error, setError] = useState('')

    const choose = async (id: string, name: string) => {
        setError('')
        setInstalling(id)

        if (await installAgent(id)) {
            onInstalled()
            return
        }

        setInstalling('')
        setError(`${name} did not install. Try again, or pick the other agent.`)
    }

    return (
        <div className="flex flex-col gap-2">
            {AGENT_CHOICES.map((choice) => (
                <button
                    key={choice.id}
                    type="button"
                    disabled={installing !== ''}
                    onClick={() => choose(choice.id, choice.name)}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-lg p-3 text-left ring-1 ring-border transition-colors hover:bg-accent disabled:pointer-events-none',
                        installing !== '' && installing !== choice.id && 'opacity-50',
                    )}
                >
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">
                            {choice.name}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                            {choice.blurb}
                        </span>
                    </span>

                    {installing === choice.id && (
                        <span className="flex shrink-0 items-center gap-2">
                            <StateIcon state="running" />
                            <span className="font-mono text-xs text-muted-foreground">
                                Installing
                            </span>
                        </span>
                    )}
                </button>
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    )
}
