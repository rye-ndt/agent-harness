import {Button} from '@/components/ui/button'
import {useMCPServers} from '@/hooks/use-mcp'
import {cn} from '@/lib/utils'
import type {MCPServer} from '@/types/settings'

export function MCPPanel() {
    const {servers, loading, error, pendingId, authorize, revoke} = useMCPServers()

    const busy = pendingId !== null
    const isEmpty = !loading && servers.length === 0

    return (
        <div className="flex flex-col">
            <div className="divide-y divide-border">
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
                            onRevoke={revoke}
                        />
                    ))}

                {isEmpty && (
                    <p className="px-4 py-3 text-base text-muted-foreground">
                        No MCP servers configured. Add one to config.yaml to see it here.
                    </p>
                )}
            </div>

            {error && (
                <p className="border-t border-border px-4 py-3 text-sm text-destructive">{error}</p>
            )}
        </div>
    )
}

function MCPServerRow({
    server,
    busy,
    pending,
    onAuthorize,
    onRevoke,
}: {
    server: MCPServer
    busy: boolean
    pending: boolean
    onAuthorize: (serverId: string) => void
    onRevoke: (serverId: string) => void
}) {
    const authorize = () => onAuthorize(server.id)
    const revoke = () => onRevoke(server.id)

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
                <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                    onClick={revoke}
                >
                    {pending ? 'Revoking' : 'Revoke'}
                </Button>
            ) : (
                <Button size="sm" className="shrink-0" disabled={busy} onClick={authorize}>
                    {pending ? 'Authorizing' : 'Authorize'}
                </Button>
            )}
        </div>
    )
}
