import {useState} from 'react'

import {GraphCanvas} from '@/components/canvas/graph-canvas'
import {SessionHeader} from '@/components/canvas/session-header'
import {NewNodeDialog} from '@/components/nodes/new-node-dialog'
import {TaskDialog} from '@/components/nodes/task-dialog'
import {OnboardingFlow} from '@/components/onboarding/onboarding-flow'
import {SessionsRail} from '@/components/sessions/sessions-rail'
import {SettingsDialog} from '@/components/settings/settings-dialog'
import {TooltipProvider} from '@/components/ui/tooltip'
import {useOnboarding} from '@/hooks/use-onboarding'
import {useSessionStore} from '@/hooks/use-session-store'
import {findTask} from '@/lib/session'
import type {Point, Task, TaskDraft} from '@/types/session'

const ORIGIN: Point = {x: 0, y: 0}

const TOOLTIP_DELAY_MS = 300

function App() {
    const store = useSessionStore()
    const onboarding = useOnboarding()

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [newNodeAt, setNewNodeAt] = useState<Point | null>(null)

    const session = store.activeSession
    const selectedTask = session ? findTask(session, store.selectedTaskId) : undefined
    const showOnboarding = onboarding.ready && onboarding.required

    const openSettings = () => setSettingsOpen(true)
    const openNewNode = () => setNewNodeAt(ORIGIN)
    const closeNewNode = () => setNewNodeAt(null)
    const closeTask = () => store.selectTask(null)

    const renameSession = (name: string) => {
        if (session) store.renameSession(session.id, name)
    }

    const finalizeSession = () => {
        if (session) store.finalizeSession(session.id)
    }

    const cloneActiveSession = () => {
        if (session) store.cloneSession(session.id)
    }

    const moveTask = (taskId: string, position: Point) => {
        if (session) store.moveTask(session.id, taskId, position)
    }

    const connectTasks = (sourceId: string, targetId: string) => {
        if (session) store.connectTasks(session.id, sourceId, targetId)
    }

    const disconnectTasks = (sourceId: string, targetId: string) => {
        if (session) store.disconnectTasks(session.id, sourceId, targetId)
    }

    const saveTask = (patch: Partial<Task>) => {
        if (session && selectedTask) store.updateTask(session.id, selectedTask.id, patch)
    }

    const deleteTask = () => {
        if (session && selectedTask) store.removeTask(session.id, selectedTask.id)
    }

    const createTask = (draft: TaskDraft) => {
        if (session && newNodeAt) store.addTask(session.id, draft, newNodeAt)
        closeNewNode()
    }

    return (
        <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
                <main className="flex min-w-0 flex-1 flex-col">
                    <SessionHeader
                        session={session}
                        onRename={renameSession}
                        onFinalize={finalizeSession}
                        onClone={cloneActiveSession}
                        onNewNode={openNewNode}
                        onOpenSettings={openSettings}
                    />

                    {session ? (
                        <GraphCanvas
                            session={session}
                            selectedTaskId={store.selectedTaskId}
                            onSelectTask={store.selectTask}
                            onMoveTask={moveTask}
                            onConnect={connectTasks}
                            onDisconnect={disconnectTasks}
                            onNewNode={setNewNodeAt}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="text-base text-muted-foreground">
                                No session open. Create one to start a chain of tasks.
                            </p>
                        </div>
                    )}
                </main>

                <SessionsRail
                    sessions={store.sessions}
                    activeSessionId={store.activeSessionId}
                    onSelect={store.selectSession}
                    onCreate={store.addSession}
                    onClone={store.cloneSession}
                    onDelete={store.deleteSession}
                />

                {session && selectedTask && (
                    <TaskDialog
                        key={selectedTask.id}
                        session={session}
                        task={selectedTask}
                        onSave={saveTask}
                        onDelete={deleteTask}
                        onClose={closeTask}
                    />
                )}

                {newNodeAt && <NewNodeDialog onCreate={createTask} onClose={closeNewNode} />}

                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

                {showOnboarding && <OnboardingFlow onDone={onboarding.complete} />}
            </div>
        </TooltipProvider>
    )
}

export default App
