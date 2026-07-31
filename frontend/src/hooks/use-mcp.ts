import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {authorizeMCPServer, listMCPServers, revokeMCPServer} from '@/api/mcp'
import type {MCPServer} from '@/types/settings'

const MCP_SERVERS_KEY = ['mcp-servers']

function messageOf(error: unknown) {
    if (!error) return null
    return error instanceof Error ? error.message : String(error)
}

function useMCPMutation(mutationFn: (serverId: string) => Promise<MCPServer>) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn,
        onSuccess: (server) => {
            queryClient.setQueryData<MCPServer[]>(MCP_SERVERS_KEY, (servers) =>
                (servers ?? []).map((current) => (current.id === server.id ? server : current)),
            )
            queryClient.invalidateQueries({queryKey: MCP_SERVERS_KEY})
        },
    })
}

export function useMCPServers() {
    const {data, isPending, error} = useQuery({
        queryKey: MCP_SERVERS_KEY,
        queryFn: listMCPServers,
    })

    const authorize = useMCPMutation(authorizeMCPServer)
    const revoke = useMCPMutation(revokeMCPServer)

    const inFlight = authorize.isPending ? authorize : revoke.isPending ? revoke : null

    return {
        servers: data ?? [],
        loading: isPending,
        error: messageOf(error ?? authorize.error ?? revoke.error),
        pendingId: inFlight?.variables ?? null,
        authorize: (serverId: string) => authorize.mutate(serverId),
        revoke: (serverId: string) => revoke.mutate(serverId),
    }
}
