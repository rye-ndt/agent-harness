import {TaskStatusDialog} from '@/features/sessions/components/inspector/task-status-dialog'
import {EditNodeDialog} from '@/features/sessions/components/nodes/edit-node-dialog'
import {TaskInputsDialog} from '@/features/sessions/components/nodes/task-inputs-dialog'
import {heldTasks, isHeld} from '@/features/sessions/task-inputs'
import type {Session, Task} from '@/features/sessions/types'
import type {ParamValue} from '@/features/templates/types'

export function TaskDialog({
    session,
    task,
    fillingInputs,
    onSave,
    onFillInputs,
    onDelete,
    onClose,
}: {
    session: Session
    task: Task
    fillingInputs: boolean
    onSave: (patch: Partial<Task>) => void
    onFillInputs: (values: Record<string, ParamValue>) => void
    onDelete: () => void
    onClose: () => void
}) {
    if (isHeld(task))
        return (
            <TaskInputsDialog
                task={task}
                waiting={heldTasks(session).length}
                busy={fillingInputs}
                onStart={onFillInputs}
                onClose={onClose}
            />
        )

    if (session.finalized) return <TaskStatusDialog task={task} onClose={onClose} />

    return <EditNodeDialog task={task} onSave={onSave} onDelete={onDelete} onClose={onClose} />
}
