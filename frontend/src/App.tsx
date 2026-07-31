import {useState} from 'react'

import {AgentsPanel} from '@/components/agents/agents-panel'
import {GraphCanvas} from '@/components/canvas/graph-canvas'
import {SessionHeader} from '@/components/canvas/session-header'
import {TaskInspector} from '@/components/inspector/task-inspector'
import {OnboardingFlow} from '@/components/onboarding/onboarding-flow'
import {SessionsRail} from '@/components/sessions/sessions-rail'
import {SettingsDialog} from '@/components/settings/settings-dialog'
import {TooltipProvider} from '@/components/ui/tooltip'
import {useOnboarding} from '@/hooks/use-onboarding'
import {useSessionStore} from '@/hooks/use-session-store'
import {findTask} from '@/lib/session'

function App() {
    const store = useSessionStore()
    const onboarding = useOnboarding()
    const [agentsOpen, setAgentsOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const session = store.activeSession
    const selectedTask = session ? findTask(session, store.selectedTaskId) : undefined

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
                {session && selectedTask && (
                    <TaskInspector
                        session={session}
                        task={selectedTask}
                        onChange={(patch) => store.updateTask(session.id, selectedTask.id, patch)}
                        onRemove={() => store.removeTask(session.id, selectedTask.id)}
                        onClose={() => store.selectTask(null)}
                    />
                )}

                <main className="flex min-w-0 flex-1 flex-col">
                    <SessionHeader
                        session={session ?? null}
                        onRename={(name) => session && store.renameSession(session.id, name)}
                        onFinalize={() => session && store.finalizeSession(session.id)}
                        onClone={() => session && store.cloneSession(session.id)}
                        onAddTask={() => session && store.addTask(session.id, {x: 0, y: 0})}
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
                            onAddTask={(position) => store.addTask(session.id, position)}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="text-sm text-muted-foreground">
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
                    onOpenAgents={() => setAgentsOpen(true)}
                />

                <AgentsPanel open={agentsOpen} onOpenChange={setAgentsOpen} />

                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

                {onboarding.ready && onboarding.required && (
                    <OnboardingFlow onDone={onboarding.complete} />
                )}
            </div>
        </TooltipProvider>
    )
}

export default App
