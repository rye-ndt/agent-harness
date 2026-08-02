import {TaskStatusDialog} from '@/components/inspector/task-status-dialog'
import {EditNodeDialog} from '@/components/nodes/edit-node-dialog'
import type {Session, Task} from '@/types/session'

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
