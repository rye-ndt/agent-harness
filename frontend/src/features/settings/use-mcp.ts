import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {authorizeMCPServer, listMCPServers, setMCPCredential} from '@/features/settings/api/mcp'
import {errorMessage} from '@/shared/lib/errors'

const MCP_SERVERS_KEY = ['mcp-servers']

export function useMCPServers() {
    const queryClient = useQueryClient()

    const {data, isPending, error} = useQuery({
        queryKey: MCP_SERVERS_KEY,
        queryFn: listMCPServers,
    })

    const authorize = useMutation({
        mutationFn: authorizeMCPServer,
        onSuccess: () => queryClient.invalidateQueries({queryKey: MCP_SERVERS_KEY}),
    })

    const setToken = useMutation({
        mutationFn: ({serverId, token}: {serverId: string; token: string}) =>
            setMCPCredential(serverId, token),
        onSuccess: () => queryClient.invalidateQueries({queryKey: MCP_SERVERS_KEY}),
    })

    return {
        servers: data ?? [],
        loading: isPending,
        error: errorMessage(error ?? authorize.error ?? setToken.error),
        pendingId: authorize.isPending ? authorize.variables : null,
        authorize: authorize.mutate,
        setToken: setToken.mutate,
        savingId: setToken.isPending ? (setToken.variables?.serverId ?? null) : null,
        savingToken: setToken.isPending,
    }
}
