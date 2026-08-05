/**
 * Sessions are authored in this module's memory. Inside the Wails webview they
 * are hydrated from the stored drafts and every change is written back as one
 * JSON doc.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {TaskState} from '@/shared/lib/enums'
import {MOCK_SESSIONS} from '@/features/sessions/mock-sessions'
import type {Session} from '@/features/sessions/types'
import {SaveSessionDraft, SessionDrafts} from '@wailsjs/go/wails_api/API'

const SETTLED_ON_DISK = new Set<TaskState>([TaskState.Done, TaskState.Failed, TaskState.Cancelled])

export let sessions: Session[] = hasWailsRuntime() ? [] : structuredClone(MOCK_SESSIONS)

let hydrated = false

export function setSessions(next: Session[]) {
    sessions = next
}

export function findSession(sessionId: string) {
    const session = sessions.find((session) => session.id === sessionId)
    if (!session) throw new Error('That session is gone. Pick another one from the rail.')
    return session
}

export function findOpenSession(sessionId: string) {
    const session = findSession(sessionId)
    if (session.finalized)
        throw new Error('This session is finalized. Duplicate it to make changes.')
    return session
}

export function findTask(session: Session, taskId: string) {
    const task = session.tasks.find((task) => task.id === taskId)
    if (!task) throw new Error('That task is gone. Pick another one on the canvas.')
    return task
}

export function replaceSession(next: Session) {
    sessions = sessions.map((session) => (session.id === next.id ? next : session))
    void saveDraft(next).catch(() => {})
    return structuredClone(next)
}

export async function saveDraft(session: Session) {
    if (!hasWailsRuntime()) return

    await bridge(() => SaveSessionDraft(session.id, JSON.stringify(session)))
}

export async function hydrate() {
    if (hydrated || !hasWailsRuntime()) return

    const drafts = await bridge(SessionDrafts)
    sessions = drafts.map((draft) => restore(JSON.parse(draft.doc) as Session))
    hydrated = true
}

/** A cancelled session is terminal, so it comes back exactly as it was stored. */
function restore(stored: Session): Session {
    const session = {...stored, cancelled: Boolean(stored.cancelled)}
    return session.cancelled ? session : resetUnfinished(session)
}

function resetUnfinished(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            SETTLED_ON_DISK.has(task.state)
                ? task
                : {
                      ...task,
                      state: session.started ? TaskState.Failed : TaskState.Idle,
                      run: undefined,
                      report: undefined,
                  },
        ),
    }
}
