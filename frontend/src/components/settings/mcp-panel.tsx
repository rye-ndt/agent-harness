import {Button} from '@/components/ui/button'
import {useMCPServers} from '@/hooks/use-mcp'
import {formatRelative} from '@/lib/format'
import {cn} from '@/lib/utils'
import type {MCPServer} from '@/types/settings'

export function MCPPanel() {
    const {servers, loading, error, pendingId, authorize} = useMCPServers()

    const busy = pendingId !== null
    const isEmpty = !loading && servers.length === 0

    return (
        <section className="flex flex-col">
            <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
                <h3 className="text-base font-medium">Servers agents can call</h3>
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
                            pending={pendingId === server.id}
                            onAuthorize={authorize}
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
}: {
    server: MCPServer
    busy: boolean
    pending: boolean
    onAuthorize: (serverId: string) => void
}) {
    const authorize = () => onAuthorize(server.id)

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <span
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    server.authorized
                        ? 'bg-state-done'
                        : 'bg-transparent ring-1 ring-inset ring-border',
                )}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-base font-medium">{server.name}</p>
                <p className="truncate font-mono text-sm text-muted-foreground">{server.url}</p>
            </div>

            {server.authorized ? (
                <span className="shrink-0 text-sm text-muted-foreground">
                    {server.authorizedAt
                        ? `Authorized ${formatRelative(server.authorizedAt)}`
                        : 'Authorized'}
                </span>
            ) : (
                <Button size="sm" className="shrink-0" disabled={busy} onClick={authorize}>
                    {pending ? 'Authorizing' : 'Authorize'}
                </Button>
            )}
        </div>
    )
}
