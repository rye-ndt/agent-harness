import {TaskStatusDialog} from '@/features/sessions/components/inspector/task-status-dialog'
import {EditNodeDialog} from '@/features/sessions/components/nodes/edit-node-dialog'
import type {Session, Task} from '@/features/sessions/types'

export function TaskDialog({
    session,
    task,
    onSave,
    onDelete,
    onClose,
}: {
    session: Session
    task: Task
    onSave: (patch: Partial<Task>) => void
    onDelete: () => void
    onClose: () => void
}) {
    if (session.finalized) return <TaskStatusDialog task={task} onClose={onClose} />

    return <EditNodeDialog task={task} onSave={onSave} onDelete={onDelete} onClose={onClose} />
}
