import {useState} from 'react'

import {GraphCanvas} from '@/features/sessions/components/canvas/graph-canvas'
import {SessionHeader} from '@/features/sessions/components/canvas/session-header'
import {DirectoryPickerHost} from '@/shared/components/directory-picker'
import {NewNodeDialog} from '@/features/sessions/components/nodes/new-node-dialog'
import {TaskDialog} from '@/features/sessions/components/nodes/task-dialog'
import {WelcomeDialog} from '@/features/onboarding/components/welcome-dialog'
import {EditLocationsDialog} from '@/features/sessions/components/edit-locations-dialog'
import {DeleteSessionDialog} from '@/features/sessions/components/delete-session-dialog'
import {NewSessionDialog} from '@/features/sessions/components/new-session-dialog'
import {SessionsRail} from '@/features/sessions/components/sessions-rail'
import {SettingsDialog} from '@/features/settings/components/settings-dialog'
import {useDependencies} from '@/features/onboarding/use-dependencies'
import {useSessionStore} from '@/features/sessions/use-session-store'
import {TaskInputsDialog} from '@/features/sessions/components/nodes/task-inputs-dialog'
import {findTask} from '@/features/sessions/graph'
import {heldTasks} from '@/features/sessions/task-inputs'
import type {Point, SessionLocations, Task, TaskDraft} from '@/features/sessions/types'
import type {ParamValue} from '@/features/templates/types'

const ORIGIN: Point = {x: 0, y: 0}

function App() {
    const store = useSessionStore()
    const dependencies = useDependencies()

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [newSessionOpen, setNewSessionOpen] = useState(false)
    const [locationsOpen, setLocationsOpen] = useState(false)
    const [newNodeAt, setNewNodeAt] = useState<Point | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [dismissedInputsId, setDismissedInputsId] = useState<string | null>(null)
    const [railOpen, setRailOpen] = useState(true)

    const session = store.activeSession
    const pendingDelete = store.sessions.find((candidate) => candidate.id === pendingDeleteId)
    const selectedTask = session ? findTask(session, store.selectedTaskId) : undefined
    const showWelcome = dependencies.ready && dependencies.required

    const held = session ? heldTasks(session) : []
    const holding = held.find(
        (task) => task.id !== dismissedInputsId && task.id !== store.selectedTaskId,
    )

    const openSettings = () => setSettingsOpen(true)
    const toggleRail = () => setRailOpen((open) => !open)
    const openNewNode = () => setNewNodeAt(ORIGIN)
    const closeNewNode = () => setNewNodeAt(null)
    const closeTask = () => store.selectTask(null)

    const openNewSession = () => setNewSessionOpen(true)
    const closeNewSession = () => setNewSessionOpen(false)

    const openLocations = () => setLocationsOpen(true)
    const closeLocations = () => setLocationsOpen(false)

    const createSession = (locations: SessionLocations) => {
        store.addSession({name: `Session ${store.sessions.length + 1}`, ...locations})
        closeNewSession()
    }

    const renameSession = (name: string) => {
        if (session) store.renameSession(session.id, name)
    }

    const saveLocations = (locations: SessionLocations) => {
        if (session) store.setLocations(session.id, locations)
    }

    const finalizeSession = () => {
        if (session) store.finalizeSession(session.id)
    }

    const runSession = () => {
        if (session) store.startSession(session.id)
    }

    const cancelSession = () => {
        if (session) store.cancelSession(session.id)
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

    const fillSelectedInputs = (values: Record<string, ParamValue>) => {
        if (session && selectedTask) store.fillTaskInputs(session.id, selectedTask.id, values)
    }

    const fillHoldingInputs = (values: Record<string, ParamValue>) => {
        if (session && holding) store.fillTaskInputs(session.id, holding.id, values)
    }

    const dismissInputs = () => setDismissedInputsId(holding?.id ?? null)

    const cancelDelete = () => setPendingDeleteId(null)

    const confirmDelete = () => {
        if (pendingDelete) store.deleteSession(pendingDelete.id)
        setPendingDeleteId(null)
    }

    const createTask = (draft: TaskDraft) => {
        if (session && newNodeAt) store.addTask(session.id, draft, newNodeAt)
        closeNewNode()
    }

    return (
        <div className="flex h-screen gap-3 overflow-hidden bg-background p-3 text-foreground">
            {railOpen && (
                <SessionsRail
                    sessions={store.sessions}
                    activeSessionId={store.activeSessionId}
                    onSelect={store.selectSession}
                    onCreate={openNewSession}
                    onClone={store.cloneSession}
                    onDelete={setPendingDeleteId}
                />
            )}

            <main className="surface-card flex min-w-0 flex-1 flex-col overflow-hidden ring-1 ring-border-strong">
                <SessionHeader
                    session={session}
                    error={store.error}
                    onRename={renameSession}
                    onEditLocations={openLocations}
                    onFinalize={finalizeSession}
                    onRun={runSession}
                    onCancel={cancelSession}
                    cancelling={store.cancellingSession}
                    onClone={cloneActiveSession}
                    onNewNode={openNewNode}
                    onOpenSettings={openSettings}
                    railOpen={railOpen}
                    onToggleRail={toggleRail}
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
                    <div className="flex flex-1 items-center justify-center bg-background">
                        <p className="text-base text-muted-foreground">
                            No session open. Create one to start a chain of tasks.
                        </p>
                    </div>
                )}
            </main>

            {pendingDelete && (
                <DeleteSessionDialog
                    key={pendingDelete.id}
                    session={pendingDelete}
                    onConfirm={confirmDelete}
                    onClose={cancelDelete}
                />
            )}

            {session && selectedTask && (
                <TaskDialog
                    key={selectedTask.id}
                    session={session}
                    task={selectedTask}
                    fillingInputs={store.fillingTaskInputs}
                    onSave={saveTask}
                    onFillInputs={fillSelectedInputs}
                    onDelete={deleteTask}
                    onClose={closeTask}
                />
            )}

            {session && holding && (
                <TaskInputsDialog
                    key={holding.id}
                    task={holding}
                    waiting={held.length}
                    busy={store.fillingTaskInputs}
                    onStart={fillHoldingInputs}
                    onClose={dismissInputs}
                />
            )}

            {newNodeAt && <NewNodeDialog onCreate={createTask} onClose={closeNewNode} />}

            {newSessionOpen && (
                <NewSessionDialog onCreate={createSession} onClose={closeNewSession} />
            )}

            {locationsOpen && session && !session.finalized && (
                <EditLocationsDialog
                    key={session.id}
                    session={session}
                    onSave={saveLocations}
                    onClose={closeLocations}
                />
            )}

            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

            <DirectoryPickerHost />

            {showWelcome && (
                <WelcomeDialog
                    dependencies={dependencies.dependencies}
                    ratio={dependencies.ratio}
                    settled={dependencies.settled}
                    canContinue={dependencies.canContinue}
                    error={dependencies.error}
                    onRetry={dependencies.retry}
                    onStart={dependencies.dismiss}
                />
            )}
        </div>
    )
}

export default App
