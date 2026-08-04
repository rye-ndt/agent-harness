/**
 * Outside the webview (the plain vite dev server) there is no runtime, so the
 * graph starts from the mock sessions and finalizing falls back to a simulated
 * run that walks the graph in order.
 */

import {TaskState} from '@/shared/lib/enums'
import {mockOutcome} from '@/features/sessions/mock-sessions'
import {hasRunningTask, isRunnable, label} from '@/features/sessions/graph'
import type {Session, Task} from '@/features/sessions/types'
import {replaceSession, sessions} from '@/features/sessions/api/store'
import {TICK_MS, timers} from '@/features/sessions/api/timers'

function start(task: Task, now: number): Task {
    const {contextTotal, contextPeak} = mockOutcome(task)

    return {
        ...task,
        state: TaskState.Running,
        run: {
            ...task.run,
            startedAt: new Date(now).toISOString(),
            finishedAt: undefined,
            context: {used: Math.round(contextTotal * contextPeak * 0.2), total: contextTotal},
        },
    }
}

function progress(task: Task, now: number): Task {
    const outcome = mockOutcome(task)
    const startedAt = task.run?.startedAt ? Date.parse(task.run.startedAt) : now
    const share = Math.min(1, Math.max(0, (now - startedAt) / outcome.durationMs))
    const context = {
        used: Math.round(outcome.contextTotal * outcome.contextPeak * (0.2 + 0.8 * share)),
        total: outcome.contextTotal,
    }

    if (share < 1) return {...task, run: {...task.run, context}}

    return {
        ...task,
        state: outcome.state,
        run: {...task.run, finishedAt: new Date(now).toISOString(), context},
        report: outcome.report,
    }
}

function advance(session: Session): Session {
    const now = Date.now()

    const progressed = label({
        ...session,
        tasks: session.tasks.map((task) =>
            task.state === TaskState.Running ? progress(task, now) : task,
        ),
    })

    return label({
        ...progressed,
        tasks: progressed.tasks.map((task) =>
            isRunnable(progressed, task) ? start(task, now) : task,
        ),
    })
}

export function tick(sessionId: string) {
    const session = sessions.find((session) => session.id === sessionId)
    if (!session?.finalized) return

    const next = replaceSession(advance(session))
    if (hasRunningTask(next)) schedule(sessionId)
}

function schedule(sessionId: string) {
    if (timers.has(sessionId)) return

    timers.set(
        sessionId,
        setTimeout(() => {
            timers.delete(sessionId)
            tick(sessionId)
        }, TICK_MS),
    )
}

export function stopRun(sessionId: string) {
    const timer = timers.get(sessionId)
    if (timer === undefined) return

    clearTimeout(timer)
    timers.delete(sessionId)
}

for (const session of sessions) if (hasRunningTask(session)) schedule(session.id)
