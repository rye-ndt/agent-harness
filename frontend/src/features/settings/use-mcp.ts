import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {authorizeMCPServer, listMCPServers, setMCPCredential} from '@/features/settings/api/mcp'

const MCP_SERVERS_KEY = ['mcp-servers']

export function useMCPServers() {
    const queryClient = useQueryClient()

    const {data, isPending} = useQuery({
        queryKey: MCP_SERVERS_KEY,
        queryFn: listMCPServers,
        meta: {action: 'Could not load the MCP servers'},
    })

    const authorize = useMutation({
        meta: {action: 'Could not authorize the server'},
        mutationFn: authorizeMCPServer,
        onSuccess: () => queryClient.invalidateQueries({queryKey: MCP_SERVERS_KEY}),
    })

    const setToken = useMutation({
        meta: {action: 'Could not save the token'},
        mutationFn: ({serverId, token}: {serverId: string; token: string}) =>
            setMCPCredential(serverId, token),
        onSuccess: () => queryClient.invalidateQueries({queryKey: MCP_SERVERS_KEY}),
    })

    return {
        servers: data ?? [],
        loading: isPending,
        pendingId: authorize.isPending ? authorize.variables : null,
        authorize: authorize.mutate,
        setToken: setToken.mutate,
        savingId: setToken.isPending ? (setToken.variables?.serverId ?? null) : null,
        savingToken: setToken.isPending,
    }
}
