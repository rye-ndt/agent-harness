import type {Session} from '@/types/session'

const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()

/** Stand-in data until the graph APIs land. Shapes match `types/session.ts` exactly. */
export const MOCK_SESSIONS: Session[] = [
    {
        id: '0198e3a1-0000-7000-8000-000000000001',
        name: 'Coordinator port',
        createdAt: '2026-07-30T09:12:00Z',
        finalized: false,
        tasks: [
            {
                id: 'task-1',
                title: 'Map the task graph ports',
                prompt: 'Read internal/interface/core and list every port the coordinator will need to call. Report the gaps.',
                agent: 'claude_code',
                state: 'done',
                position: {x: 0, y: 120},
                dependsOn: [],
                run: {
                    startedAt: '2026-07-30T09:12:04Z',
                    finishedAt: '2026-07-30T09:18:41Z',
                    context: {used: 41200, total: 200000},
                    log: [
                        'Reading internal/interface/core/*.go',
                        'Found 6 ports: AgentManager, ApprovalBroker, MCPProxyServer, TaskGraph, WAL, Clock',
                        'TaskGraph has no coordinator hook — that is the gap.',
                        'Done. Handover written.',
                    ],
                },
            },
            {
                id: 'task-2',
                title: 'Draft the coordinator interface',
                prompt: 'Using the handover, add a Coordinator port to internal/interface/core. Keep it minimal.',
                agent: 'claude_code',
                state: 'running',
                position: {x: 340, y: 0},
                dependsOn: ['task-1'],
                run: {
                    startedAt: secondsAgo(94),
                    context: {used: 128400, total: 200000},
                    log: [
                        'Read handover from "Map the task graph ports"',
                        'Writing internal/interface/core/coordinator.go',
                        'Coordinator needs NodeFinished, NextNodes, BuildContext',
                        'Checking that nothing in implementation/ imports it yet…',
                    ],
                },
            },
            {
                id: 'task-3',
                title: 'Write the handover builder',
                prompt: 'Build the HandoverDoc composer that turns a finished node into the next node prompt.',
                agent: 'opencode',
                state: 'awaiting_approval',
                position: {x: 340, y: 240},
                dependsOn: ['task-1'],
                run: {
                    startedAt: secondsAgo(38),
                    context: {used: 96300, total: 200000},
                    log: [
                        'Read handover from "Map the task graph ports"',
                        'Drafting HandoverDoc composer',
                        'Requesting permission to write outside internal/',
                    ],
                },
                approval: {
                    id: 'approval-1',
                    question: 'Write to docs/handover-format.md?',
                    detail: 'The composer needs a written format spec. This path is outside internal/, which the task scope did not cover.',
                    options: [
                        {
                            id: 'allow-once',
                            label: 'Allow once',
                            description: 'Write this file, then keep asking for anything else outside scope.',
                        },
                        {
                            id: 'allow-docs',
                            label: 'Allow all of docs/',
                            description: 'Stop asking for writes under docs/ for the rest of this run.',
                        },
                    ],
                    multiSelect: false,
                },
            },
            {
                id: 'task-4',
                title: 'Wire it into wire.go',
                prompt: 'Compose the coordinator in wire.go. It is the only composition root.',
                agent: 'claude_code',
                state: 'blocked',
                position: {x: 680, y: 120},
                dependsOn: ['task-2', 'task-3'],
            },
            {
                id: 'task-5',
                title: 'Typecheck and vet',
                prompt: 'Run go build ./..., go vet ./..., and npx tsc --noEmit in frontend/. Report anything that fails.',
                agent: 'claude_code',
                state: 'blocked',
                position: {x: 1020, y: 120},
                dependsOn: ['task-4'],
            },
        ],
    },
    {
        id: '0198e3a1-0000-7000-8000-000000000002',
        name: 'MCP proxy hardening',
        createdAt: '2026-07-28T14:40:00Z',
        finalized: true,
        tasks: [
            {
                id: 'task-6',
                title: 'Audit the forwarding path',
                prompt: 'Trace every request the proxy forwards and note where errors are swallowed.',
                agent: 'claude_code',
                state: 'done',
                position: {x: 0, y: 60},
                dependsOn: [],
                run: {log: ['Traced 3 forwarding paths', 'Two swallow errors', 'Done.']},
            },
            {
                id: 'task-7',
                title: 'Add timeouts',
                prompt: 'Every forwarded call gets a deadline from config.',
                agent: 'claude_code',
                state: 'done',
                position: {x: 340, y: 60},
                dependsOn: ['task-6'],
                run: {log: ['Added deadline plumbing', 'Done.']},
            },
        ],
    },
    {
        id: '0198e3a1-0000-7000-8000-000000000003',
        name: 'WAL replay spike',
        createdAt: '2026-07-31T08:05:00Z',
        finalized: false,
        tasks: [],
    },
]
