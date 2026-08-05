import {ConfirmDialog} from '@/shared/components/confirm-dialog'
import {sessionProgress} from '@/features/sessions/graph'
import type {Session} from '@/features/sessions/types'

function stakes(session: Session) {
    const {done, total} = sessionProgress(session)

    if (total === 0) return 'It has no nodes yet.'
    if (done === 0) return `Its ${total} ${total === 1 ? 'node goes' : 'nodes go'} with it.`

    return `Its ${total} nodes go with it, including ${done} finished and their reports.`
}

export function DeleteSessionDialog({
    session,
    onConfirm,
    onClose,
}: {
    session: Session
    onConfirm: () => void
    onClose: () => void
}) {
    return (
        <ConfirmDialog
            title={`Delete “${session.name}”?`}
            description={`${stakes(session)} This cannot be undone.`}
            confirmLabel="Delete session"
            destructive
            onConfirm={onConfirm}
            onClose={onClose}
        />
    )
}
