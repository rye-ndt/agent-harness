/**
 * What a running node is doing, right now. Activity is chatter rather than
 * state: it lives in this module's memory and never lands on a Task or a
 * Session, because every change to a Session is written back to disk as one
 * JSON doc and this feed grows for the whole life of a run.
 *
 * The array held for a task keeps its identity until something newer merges,
 * so a poll that brings nothing new does not re-render the node.
 */

import type {ActivityLine, Session} from '@/features/sessions/types'

const MAX_LINES = 200

const NO_LINES: ActivityLine[] = []

const linesByTask = new Map<string, ActivityLine[]>()

function highestSeq(lines: ActivityLine[]) {
    return lines.length === 0 ? 0 : lines[lines.length - 1].seq
}

export function mergeActivity(taskId: string, incoming: ActivityLine[]) {
    if (incoming.length === 0) return

    const held = linesByTask.get(taskId) ?? NO_LINES
    const highest = highestSeq(held)

    // A retry hands the task to a fresh agent, which counts from one again.
    if (highestSeq(incoming) < highest) {
        linesByTask.set(taskId, incoming.slice(-MAX_LINES))
        return
    }

    const fresh = incoming.filter((line) => line.seq > highest)
    if (fresh.length === 0) return

    linesByTask.set(taskId, [...held, ...fresh].slice(-MAX_LINES))
}

export async function taskActivity(taskId: string): Promise<ActivityLine[]> {
    return linesByTask.get(taskId) ?? NO_LINES
}

export function forgetActivity(taskId: string) {
    linesByTask.delete(taskId)
}

export function forgetSessionActivity(session: Session) {
    for (const task of session.tasks) forgetActivity(task.id)
}
