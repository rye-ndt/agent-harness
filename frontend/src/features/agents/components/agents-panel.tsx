import {AgentLogin} from '@/features/agents/components/agent-login'
import {Button} from '@/shared/ui/button'
import {useAgents} from '@/features/agents/use-agents'
import {cn} from '@/shared/lib/utils'
import type {Agent} from '@/features/agents/types'

function metaLine(agent: Agent) {
    if (!agent.installed) return 'Not installed'
    return `v${agent.version.replace(/^v/, '')} · ${agent.instanceCount} running`
}

function LoginBadge({loggedIn}: {loggedIn: boolean}) {
    return (
        <span
            className={cn(
                'shrink-0 rounded-sm px-2.5 py-1 text-xs leading-none font-bold tracking-[0.05em] uppercase',
                loggedIn
                    ? 'bg-state-done-tint text-state-done'
                    : 'bg-state-idle-tint text-muted-foreground',
            )}
        >
            {loggedIn ? 'Logged in' : 'Not logged in'}
        </span>
    )
}

export function AgentsPanel() {
    const {
        agents,
        error,
        busy,
        busyLabel,
        authUrlOf,
        install,
        uninstall,
        logIn,
        submitAuthCode,
        openAuthUrl,
    } = useAgents()

    const isEmpty = agents.length === 0 && !error

    return (
        <section className="flex flex-col">
            <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
                <h3 className="text-base font-medium">Harnesses that run your nodes</h3>
                <p className="text-sm text-muted-foreground">
                    A harness has to be installed and logged in before a session can assign work to
                    it.
                </p>
            </div>

            <div className="divide-y divide-border border-t border-border">
                {agents.map((agent) => (
                    <AgentRow
                        key={agent.id}
                        agent={agent}
                        busy={busy}
                        busyLabel={busyLabel(agent.id)}
                        authUrl={authUrlOf(agent.id)}
                        onInstall={install}
                        onUninstall={uninstall}
                        onLogIn={logIn}
                        onSubmitCode={submitAuthCode}
                        onOpenAuthUrl={openAuthUrl}
                    />
                ))}

                {isEmpty && (
                    <p className="px-4 py-3 text-base text-muted-foreground">
                        No agents configured. Add one to config.yaml to see it here.
                    </p>
                )}
            </div>

            {error && (
                <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            )}
        </section>
    )
}

function AgentRow({
    agent,
    busy,
    busyLabel,
    authUrl,
    onInstall,
    onUninstall,
    onLogIn,
    onSubmitCode,
    onOpenAuthUrl,
}: {
    agent: Agent
    busy: boolean
    busyLabel: string | null
    authUrl: string | null
    onInstall: (agentId: string) => void
    onUninstall: (agentId: string) => void
    onLogIn: (agentId: string) => void
    onSubmitCode: (agentId: string, code: string) => void
    onOpenAuthUrl: (url: string) => void
}) {
    const showLogin = authUrl !== null && !agent.loggedIn

    const install = () => onInstall(agent.id)
    const uninstall = () => onUninstall(agent.id)
    const logIn = () => onLogIn(agent.id)

    return (
        <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex items-center gap-2">
                        <span className="truncate font-mono text-base font-medium">
                            {agent.name}
                        </span>
                        {agent.installed && <LoginBadge loggedIn={agent.loggedIn} />}
                    </p>
                    <p className="truncate font-mono text-sm text-muted-foreground">
                        {metaLine(agent)}
                    </p>
                </div>

                {agent.installed ? (
                    <div className="flex shrink-0 gap-2">
                        {!agent.loggedIn && (
                            <Button size="sm" disabled={busy} onClick={logIn}>
                                {busyLabel === 'Logging in' ? 'Logging in' : 'Log in'}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy}
                            onClick={uninstall}
                        >
                            {busyLabel === 'Uninstalling' ? 'Uninstalling' : 'Uninstall'}
                        </Button>
                    </div>
                ) : (
                    <Button size="sm" className="shrink-0" disabled={busy} onClick={install}>
                        {busyLabel ?? 'Install'}
                    </Button>
                )}
            </div>

            {showLogin && (
                <AgentLogin
                    agentId={agent.id}
                    authUrl={authUrl}
                    busy={busy}
                    verifying={busyLabel === 'Verifying'}
                    onSubmitCode={onSubmitCode}
                    onOpenAuthUrl={onOpenAuthUrl}
                />
            )}
        </div>
    )
}
