import type {MCPServer} from '@/features/settings/types'

const FIGMA_TOKEN_PREFIX = 'figd_'

const alreadyFailed = new Set<string>()

function goError(errorType: string, message: string) {
    return new Error(`[Err] Type: ${errorType} - Message: ${message} - Critical: critical`)
}

export function mockAuthorizeFailure(serverId: string) {
    const forced = new URLSearchParams(window.location.search).get('mcpFail')
    if (forced !== serverId && forced !== 'all') return null
    if (alreadyFailed.has(serverId)) return null

    alreadyFailed.add(serverId)

    return goError(
        'err_mcp_authorize_timeout',
        `timed out waiting for the ${serverId} callback after 2m0s`,
    )
}

export function mockTokenFailure(serverId: string, token: string) {
    if (token.startsWith(FIGMA_TOKEN_PREFIX)) return null

    return goError('err_mcp_token_exchange', `${serverId} rejected the token: 403 Invalid token`)
}

export const MOCK_MCP_SERVERS: MCPServer[] = [
    {
        id: 'atlassian',
        name: 'Atlassian',
        url: 'https://mcp.atlassian.com/v1/sse',
        authorized: true,
        authorizedAt: '2026-07-24T09:12:00.000Z',
        kind: 'dcr',
    },
    {
        id: 'github',
        name: 'GitHub',
        url: 'https://api.githubcopilot.com/mcp',
        authorized: true,
        authorizedAt: '2026-07-28T15:40:00.000Z',
        kind: 'device',
    },
    {
        id: 'linear',
        name: 'Linear',
        url: 'https://mcp.linear.app/sse',
        authorized: false,
        kind: 'dcr',
    },
    {
        id: 'sentry',
        name: 'Sentry',
        url: 'https://mcp.sentry.dev/sse',
        authorized: false,
        kind: 'dcr',
    },
    {
        id: 'figma',
        name: 'Figma',
        url: 'https://api.figma.com',
        authorized: false,
        kind: 'token',
    },
]
