import {useState, type FormEvent} from 'react'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'
import {useMCPServers} from '@/features/settings/use-mcp'
import {formatRelative} from '@/shared/lib/format'
import type {MCPServer} from '@/features/settings/types'

export function MCPPanel() {
    const {servers, loading, error, pendingId, authorize, setToken, savingId, savingToken} =
        useMCPServers()

    const busy = pendingId !== null || savingToken
    const isEmpty = !loading && servers.length === 0

    return (
        <section className="flex flex-col">
            <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
                <h3 className="text-lg font-medium">Servers agents can call</h3>
                <p className="text-sm text-muted-foreground">
                    The list comes from config.yaml. Authorize a server once and every agent reaches
                    it through the proxy.
                </p>
            </div>

            <div className="divide-y divide-border border-t border-border">
                {loading && (
                    <p className="px-4 py-3 text-base text-muted-foreground">
                        Loading MCP servers…
                    </p>
                )}

                {!loading &&
                    servers.map((server) => (
                        <MCPServerRow
                            key={server.id}
                            server={server}
                            busy={busy}
                            pending={pendingId === server.id || savingId === server.id}
                            onAuthorize={authorize}
                            onSetToken={setToken}
                        />
                    ))}

                {isEmpty && (
                    <p className="px-4 py-3 text-base text-muted-foreground">
                        No MCP servers in config.yaml. Add one there and reopen this panel.
                    </p>
                )}
            </div>

            {error && (
                <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            )}
        </section>
    )
}

function MCPServerRow({
    server,
    busy,
    pending,
    onAuthorize,
    onSetToken,
}: {
    server: MCPServer
    busy: boolean
    pending: boolean
    onAuthorize: (serverId: string) => void
    onSetToken: (input: {serverId: string; token: string}) => void
}) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-base font-medium">{server.name}</p>
                <p className="truncate font-mono text-sm text-muted-foreground">{server.url}</p>
            </div>

            {server.authorized ? (
                <span className="flex shrink-0 items-center gap-2">
                    {server.authorizedAt && (
                        <span className="text-sm text-muted-foreground">
                            {formatRelative(server.authorizedAt)}
                        </span>
                    )}
                    <span className="rounded-sm bg-state-done-tint px-2.5 py-1 text-xs leading-none font-bold tracking-[0.05em] text-state-done uppercase">
                        {server.kind === 'token' ? 'Connected' : 'Authorized'}
                    </span>
                </span>
            ) : server.kind === 'token' ? (
                <MCPTokenForm
                    busy={busy}
                    pending={pending}
                    onSubmit={(token) => onSetToken({serverId: server.id, token})}
                />
            ) : (
                <Button
                    size="sm"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => onAuthorize(server.id)}
                >
                    {pending ? 'Authorizing' : 'Authorize'}
                </Button>
            )}
        </div>
    )
}

function MCPTokenForm({
    busy,
    pending,
    onSubmit,
}: {
    busy: boolean
    pending: boolean
    onSubmit: (token: string) => void
}) {
    const [token, setToken] = useState('')
    const trimmed = token.trim()

    const submit = (event: FormEvent) => {
        event.preventDefault()
        if (!trimmed) return
        onSubmit(trimmed)
        setToken('')
    }

    return (
        <form className="flex shrink-0 items-center gap-2" onSubmit={submit}>
            <Input
                type="password"
                className="h-8 w-48"
                placeholder="Paste access token"
                value={token}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setToken(event.target.value)}
            />
            <Button size="sm" type="submit" disabled={busy || !trimmed}>
                {pending ? 'Saving' : 'Save token'}
            </Button>
        </form>
    )
}
