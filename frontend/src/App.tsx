import {useState} from 'react'

import {GraphCanvas} from '@/components/canvas/graph-canvas'
import {SessionHeader} from '@/components/canvas/session-header'
import {TaskStatusDialog} from '@/components/inspector/task-status-dialog'
import {EditNodeDialog} from '@/components/nodes/edit-node-dialog'
import {NewNodeDialog} from '@/components/nodes/new-node-dialog'
import {OnboardingFlow} from '@/components/onboarding/onboarding-flow'
import {SessionsRail} from '@/components/sessions/sessions-rail'
import {SettingsDialog} from '@/components/settings/settings-dialog'
import {TooltipProvider} from '@/components/ui/tooltip'
import {useOnboarding} from '@/hooks/use-onboarding'
import {useSessionStore} from '@/hooks/use-session-store'
import {findTask} from '@/lib/session'
import type {Point} from '@/types/session'

function App() {
    const store = useSessionStore()
    const onboarding = useOnboarding()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [newNodeAt, setNewNodeAt] = useState<Point | null>(null)

    const session = store.activeSession
    const selectedTask = session ? findTask(session, store.selectedTaskId) : undefined

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
                <main className="flex min-w-0 flex-1 flex-col">
                    <SessionHeader
                        session={session ?? null}
                        onRename={(name) => session && store.renameSession(session.id, name)}
                        onFinalize={() => session && store.finalizeSession(session.id)}
                        onClone={() => session && store.cloneSession(session.id)}
                        onNewNode={() => setNewNodeAt({x: 0, y: 0})}
                        onOpenSettings={() => setSettingsOpen(true)}
                    />

                    {session ? (
                        <GraphCanvas
                            session={session}
                            selectedTaskId={store.selectedTaskId}
                            onSelectTask={store.selectTask}
                            onMoveTask={(taskId, position) =>
                                store.moveTask(session.id, taskId, position)
                            }
                            onConnect={(sourceId, targetId) =>
                                store.connectTasks(session.id, sourceId, targetId)
                            }
                            onDisconnect={(sourceId, targetId) =>
                                store.disconnectTasks(session.id, sourceId, targetId)
                            }
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

                {session &&
                    selectedTask &&
                    (session.finalized ? (
                        <TaskStatusDialog
                            key={selectedTask.id}
                            task={selectedTask}
                            onClose={() => store.selectTask(null)}
                        />
                    ) : (
                        <EditNodeDialog
                            key={selectedTask.id}
                            task={selectedTask}
                            onSave={(patch) => store.updateTask(session.id, selectedTask.id, patch)}
                            onDelete={() => store.removeTask(session.id, selectedTask.id)}
                            onClose={() => store.selectTask(null)}
                        />
                    ))}

                <NewNodeDialog
                    open={newNodeAt !== null}
                    onOpenChange={(open) => !open && setNewNodeAt(null)}
                    onCreate={(draft) => {
                        if (session && newNodeAt) store.addTask(session.id, draft, newNodeAt)
                        setNewNodeAt(null)
                    }}
                />

                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

                {onboarding.ready && onboarding.required && (
                    <OnboardingFlow onDone={onboarding.complete} />
                )}
            </div>
        </TooltipProvider>
    )
}

export default App
