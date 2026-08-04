import {AgentLogin} from '@/features/agents/components/agent-login'
import {Button} from '@/shared/ui/button'
import {isAgentReady, type RequiredAgent} from '@/features/sessions/use-required-agents'
import {formatAgentName} from '@/shared/lib/format'
import {cn} from '@/shared/lib/utils'

type AgentActions = {
    busy: boolean
    busyLabel: (agentId: string) => string | null
    authUrlOf: (agentId: string) => string | null
    onInstall: (agentId: string) => void
    onLogIn: (agentId: string) => void
    onSubmitCode: (agentId: string, code: string) => void
    onOpenAuthUrl: (url: string) => void
}

export function RequiredAgents({
    required,
    loading,
    actions,
}: {
    required: RequiredAgent[]
    loading: boolean
    actions: AgentActions
}) {
    return (
        <div className="flex flex-col">
            <p className="px-4 py-4 text-base text-muted-foreground">
                Your preferences run on these agents. Each one has to be logged in before the
                session can start.
            </p>

            {loading ? (
                <p className="px-4 py-3 text-base text-muted-foreground">Checking agents…</p>
            ) : (
                <div className="divide-y divide-border border-t border-border">
                    {required.map((entry) => (
                        <RequiredAgentRow key={entry.harness} entry={entry} actions={actions} />
                    ))}
                </div>
            )}
        </div>
    )
}

function statusLine(entry: RequiredAgent) {
    if (!entry.agent) return 'Not available — add it to config.yaml'
    if (!entry.agent.installed) return 'Not installed'
    if (!entry.agent.loggedIn) return 'Not logged in'
    return `v${entry.agent.version} · Ready`
}

function RequiredAgentRow({entry, actions}: {entry: RequiredAgent; actions: AgentActions}) {
    const {agent} = entry
    const ready = isAgentReady(entry)
    const authUrl = agent ? actions.authUrlOf(agent.id) : null
    const busyLabel = agent ? actions.busyLabel(agent.id) : null

    const install = () => agent && actions.onInstall(agent.id)
    const logIn = () => agent && actions.onLogIn(agent.id)

    return (
        <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        'size-2 shrink-0 rounded-full',
                        ready ? 'bg-state-done' : 'bg-state-approval',
                    )}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-base font-medium">
                        {agent?.name ?? formatAgentName(entry.harness)}
                    </p>
                    <p className="truncate font-mono text-sm text-muted-foreground">
                        {statusLine(entry)}
                    </p>
                </div>

                {agent && !agent.installed && (
                    <Button
                        size="sm"
                        className="shrink-0"
                        disabled={actions.busy}
                        onClick={install}
                    >
                        {busyLabel ?? 'Install'}
                    </Button>
                )}

                {agent?.installed && !agent.loggedIn && (
                    <Button size="sm" className="shrink-0" disabled={actions.busy} onClick={logIn}>
                        {busyLabel === 'Logging in' ? 'Logging in' : 'Log in'}
                    </Button>
                )}
            </div>

            <p className="text-sm text-muted-foreground">
                Runs {entry.modelLabels.join(', ')} for your task levels.
            </p>

            {agent && authUrl && !agent.loggedIn && (
                <AgentLogin
                    agentId={agent.id}
                    authUrl={authUrl}
                    busy={actions.busy}
                    verifying={busyLabel === 'Verifying'}
                    onSubmitCode={actions.onSubmitCode}
                    onOpenAuthUrl={actions.onOpenAuthUrl}
                />
            )}
        </div>
    )
}
