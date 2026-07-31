import type {MCPServer} from '@/types/settings'

export const MOCK_MCP_SERVERS: MCPServer[] = [
    {
        id: 'atlassian',
        name: 'Atlassian',
        url: 'https://mcp.atlassian.com/v1/sse',
        authorized: true,
        authorizedAt: '2026-07-24T09:12:00.000Z',
    },
    {
        id: 'github',
        name: 'GitHub',
        url: 'https://api.githubcopilot.com/mcp',
        authorized: true,
        authorizedAt: '2026-07-28T15:40:00.000Z',
    },
    {
        id: 'linear',
        name: 'Linear',
        url: 'https://mcp.linear.app/sse',
        authorized: false,
    },
    {
        id: 'sentry',
        name: 'Sentry',
        url: 'https://mcp.sentry.dev/sse',
        authorized: false,
    },
]
