/**
 * Outside the webview there is no agent to narrate itself, so a simulated run
 * writes its own feed: a fixed script of plausible steps, picked and paced from
 * the task id so the same node always says the same things in the same order.
 * A node the mock is going to fail spends its last lines struggling.
 */

import {TaskState} from '@/shared/lib/enums'
import {mockOutcome} from '@/features/sessions/mock-sessions'
import type {ActivityLine, Task} from '@/features/sessions/types'

const LINE_GAP_MS = 1200

const MIN_LINES = 8

const MAX_LINES = 15

const FILES = [
    'internal/interface/core/session_manager.go',
    'internal/implementation/mcp_proxy/v1.go',
    'internal/implementation/wal/replay.go',
    'internal/implementation/agent_manager/v1.go',
    'internal/implementation/claude_code/v1.go',
    'internal/implementation/session_manager/v1.go',
    'internal/helpers/custom_error/errors.go',
    'frontend/src/features/sessions/graph.ts',
    'wire.go',
]

const SEARCHES = [
    'where the coordinator reads context usage',
    'where the heartbeat sweep writes a terminal state',
    'the places a HandoverDoc is composed',
    'anything that still imports task_manager',
    'the config key the proxy reads its deadline from',
    'goroutines started without an exit path',
]

const CLOSING = [
    'Running go test ./...',
    'Tests pass.',
    'Writing up what the next node needs to know.',
]

const STRUGGLING = [
    'Running go test ./...',
    'One test still fails. Trying a narrower change.',
    'Still failing. The real fix is in a file this step cannot touch.',
]

function seedOf(id: string) {
    let seed = 0
    for (let index = 0; index < id.length; index += 1)
        seed = (seed * 31 + id.charCodeAt(index)) % 99991
    return seed
}

function spineOf(task: Task): string[] {
    const seed = seedOf(task.id)
    const files = Array.from({length: 4}, (_, index) => FILES[(seed + index * 2) % FILES.length])

    return [
        `Reading the prompt for "${task.title}".`,
        `Reading ${files[0]}.`,
        `Searching for ${SEARCHES[seed % SEARCHES.length]}.`,
        `Reading ${files[1]}.`,
        `Editing ${files[1]}.`,
        'Running go build ./...',
        `Reading ${files[2]}.`,
        `Editing ${files[2]}.`,
        `Reading ${files[3]}.`,
        `Editing ${files[3]}.`,
        'Re-reading the diff so far.',
        'Running gofmt on the files I touched.',
    ]
}

function lineCount(durationMs: number) {
    return Math.min(MAX_LINES, Math.max(MIN_LINES, Math.round(durationMs / LINE_GAP_MS)))
}

/** Every line the node should have said by `now`, oldest first. */
export function mockActivity(task: Task, now: number): ActivityLine[] {
    const outcome = mockOutcome(task)
    const tail = outcome.state === TaskState.Failed ? STRUGGLING : CLOSING
    const count = lineCount(outcome.durationMs)
    const texts = [...spineOf(task).slice(0, count - tail.length), ...tail]

    const startedAt = task.run?.startedAt ? Date.parse(task.run.startedAt) : now
    const gap = outcome.durationMs / count
    const said = Math.min(texts.length, Math.max(1, Math.floor((now - startedAt) / gap) + 1))

    return Array.from({length: said}, (_, index) => ({
        seq: index + 1,
        at: new Date(startedAt + index * gap).toISOString(),
        text: texts[index],
    }))
}
