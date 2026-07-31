import {Button} from '@/components/ui/button'
import {useMCPServers} from '@/hooks/use-mcp'
import {cn} from '@/lib/utils'

export function MCPPanel() {
    const {servers, loading, error, pendingId, authorize, revoke} = useMCPServers()
    const busy = pendingId !== null

    return (
        <div className="flex flex-col">
            <p className="px-4 py-3 text-xs text-muted-foreground">
                Tools your agents can call. Shared by every session.
            </p>

            <div className="divide-y divide-border border-t border-border">
                {loading && (
                    <p className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
                        Loading MCP servers…
                    </p>
                )}

                {!loading &&
                    servers.map((server) => (
                        <div key={server.id} className="flex items-center gap-3 px-4 py-3">
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    server.authorized
                                        ? 'bg-state-done'
                                        : 'bg-transparent ring-1 ring-inset ring-border',
                                )}
                            />

                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <p className="truncate text-[0.8125rem] font-medium">
                                    {server.name}
                                </p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                    {server.url}
                                </p>
                            </div>

                            {server.authorized ? (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    disabled={busy}
                                    onClick={() => revoke(server.id)}
                                >
                                    {pendingId === server.id ? 'Revoking' : 'Revoke'}
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    className="shrink-0"
                                    disabled={busy}
                                    onClick={() => authorize(server.id)}
                                >
                                    {pendingId === server.id ? 'Authorizing' : 'Authorize'}
                                </Button>
                            )}
                        </div>
                    ))}

                {!loading && servers.length === 0 && (
                    <p className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
                        No MCP servers configured. Add one to config.yaml to see it here.
                    </p>
                )}
            </div>

            {error && (
                <p className="border-t border-border px-4 py-3 text-xs text-destructive">{error}</p>
            )}
        </div>
    )
}
