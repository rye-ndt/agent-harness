import {MOCK_MCP_SERVERS} from '@/lib/mock-mcp'
import type {MCPServer} from '@/types/settings'

const ROUNDTRIP_MS = 700

let servers: MCPServer[] = structuredClone(MOCK_MCP_SERVERS)

function findServer(serverId: string) {
    const server = servers.find((server) => server.id === serverId)
    if (!server) throw new Error('That MCP server is no longer configured.')
    return server
}

function replaceServer(next: MCPServer) {
    servers = servers.map((server) => (server.id === next.id ? next : server))
    return structuredClone(next)
}

async function roundtrip() {
    await new Promise((resolve) => setTimeout(resolve, ROUNDTRIP_MS))
}

export async function listMCPServers(): Promise<MCPServer[]> {
    return structuredClone(servers)
}

export async function authorizeMCPServer(serverId: string): Promise<MCPServer> {
    const server = findServer(serverId)
    await roundtrip()

    return replaceServer({
        ...server,
        authorized: true,
        authorizedAt: new Date().toISOString(),
    })
}

export async function revokeMCPServer(serverId: string): Promise<MCPServer> {
    const server = findServer(serverId)
    await roundtrip()

    return replaceServer({...server, authorized: false, authorizedAt: undefined})
}
