import {useState, type ChangeEvent, type KeyboardEvent} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {useAgents} from '@/hooks/use-agents'
import {cn} from '@/lib/utils'
import type {Agent} from '@/types/agent'

function metaLine(agent: Agent) {
    if (!agent.installed) return 'Not installed'
    if (!agent.loggedIn) return `v${agent.version} · Not logged in`
    return `v${agent.version} · ${agent.instanceCount} running`
}

function dotClass(agent: Agent) {
    if (!agent.installed) return 'bg-transparent ring-1 ring-inset ring-border'
    return agent.loggedIn ? 'bg-state-done' : 'bg-state-idle'
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
        <div className="flex flex-col">
            <div className="divide-y divide-border">
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
            </div>

            {isEmpty && (
                <p className="px-4 py-3 text-base text-muted-foreground">
                    No agents configured. Add one to config.yaml to see it here.
                </p>
            )}

            {error && (
                <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            )}
        </div>
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
                <span className={cn('size-2 shrink-0 rounded-full', dotClass(agent))} />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-base font-medium">{agent.name}</p>
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

function AgentLogin({
    agentId,
    authUrl,
    busy,
    verifying,
    onSubmitCode,
    onOpenAuthUrl,
}: {
    agentId: string
    authUrl: string
    busy: boolean
    verifying: boolean
    onSubmitCode: (agentId: string, code: string) => void
    onOpenAuthUrl: (url: string) => void
}) {
    const [code, setCode] = useState('')

    const trimmed = code.trim()
    const canSubmit = trimmed.length > 0 && !busy

    const submit = () => {
        if (!canSubmit) return

        onSubmitCode(agentId, trimmed)
        setCode('')
    }

    const openUrl = () => onOpenAuthUrl(authUrl)

    const changeCode = (event: ChangeEvent<HTMLInputElement>) => setCode(event.target.value)

    const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') submit()
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 ring-1 ring-border">
            <p className="text-sm text-muted-foreground">
                A login page opened in your browser.{' '}
                <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={openUrl}
                >
                    Open it again
                </button>{' '}
                if it didn't. Most logins finish on their own once you approve. Paste a code below
                only if the page shows you one.
            </p>

            <div className="flex gap-2">
                <Input
                    value={code}
                    placeholder="Authorization code"
                    aria-label="Authorization code"
                    className="bg-background font-mono"
                    onChange={changeCode}
                    onKeyDown={submitOnEnter}
                />
                <Button size="sm" disabled={!canSubmit} onClick={submit}>
                    {verifying ? 'Verifying' : 'Submit'}
                </Button>
            </div>
        </div>
    )
}
