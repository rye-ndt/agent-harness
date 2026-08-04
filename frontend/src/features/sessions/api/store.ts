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
    sessions = drafts.map((draft) => resetUnfinished(JSON.parse(draft.doc) as Session))
    hydrated = true
}

function resetUnfinished(session: Session): Session {
    return {
        ...session,
        tasks: session.tasks.map((task) =>
            task.state === TaskState.Done || task.state === TaskState.Failed
                ? task
                : {
                      ...task,
                      state: session.finalized ? TaskState.Failed : TaskState.Idle,
                      run: undefined,
                      report: undefined,
                  },
        ),
    }
}
