/**
 * The only place the generated Wails bindings for MCP are touched. The roster
 * is declared in config.yaml, so the Go side lists servers and authorizes one —
 * there is no add, edit or delete. Under the plain vite dev server the same
 * contract is answered from src/lib/mock-mcp.ts.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {MOCK_MCP_SERVERS} from '@/features/settings/mock-mcp'
import type {MCPServer} from '@/features/settings/types'
import {AuthorizeMCPServer, MCPServers} from '@wailsjs/go/wails_api/API'

const ROUNDTRIP_MS = 700

let servers: MCPServer[] = structuredClone(MOCK_MCP_SERVERS)

async function roundtrip() {
    await new Promise((resolve) => setTimeout(resolve, ROUNDTRIP_MS))
}

export async function listMCPServers(): Promise<MCPServer[]> {
    if (!hasWailsRuntime()) return structuredClone(servers)

    const infos = await bridge(MCPServers)

    return infos.map((info) => ({
        id: info.name,
        name: info.name,
        url: info.url,
        authorized: info.authorized,
        authorizedAt: info.authorized_at || undefined,
    }))
}

export async function authorizeMCPServer(serverId: string): Promise<void> {
    if (hasWailsRuntime()) {
        await bridge(() => AuthorizeMCPServer(serverId))
        return
    }

    if (!servers.some((server) => server.id === serverId))
        throw new Error('That MCP server is no longer configured.')

    await roundtrip()

    servers = servers.map((server) =>
        server.id === serverId
            ? {...server, authorized: true, authorizedAt: new Date().toISOString()}
            : server,
    )
}
