import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {authorizeMCPServer, listMCPServers} from '@/api/mcp'
import {errorMessage} from '@/lib/errors'

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

    return {
        servers: data ?? [],
        loading: isPending,
        error: errorMessage(error ?? authorize.error),
        pendingId: authorize.isPending ? authorize.variables : null,
        authorize: authorize.mutate,
    }
}
