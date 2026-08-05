import type {MCPServer} from '@/features/settings/types'

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
