import {useState} from 'react'

import {DialogShell} from '@/components/common/dialog-shell'
import {
    SessionLocationsFields,
    type SessionLocations,
} from '@/components/sessions/session-locations'
import {Button} from '@/components/ui/button'
import type {Session} from '@/types/session'

export function EditLocationsDialog({
    session,
    onSave,
    onClose,
}: {
    session: Session
    onSave: (locations: SessionLocations) => void
    onClose: () => void
}) {
    const [workingDir, setWorkingDir] = useState(session.workingDir)
    const [contextDir, setContextDir] = useState(session.contextDir)

    const changed = workingDir !== session.workingDir || contextDir !== session.contextDir
    const ready = changed && workingDir.length > 0 && contextDir.length > 0

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const save = () => {
        if (!ready) return

        onSave({workingDir, contextDir})
        onClose()
    }

    return (
        <DialogShell
            open
            onOpenChange={close}
            title="Session directories"
            description="Where this session runs. Finalizing locks them."
            footer={
                <>
                    <span className="flex-1" />
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={!ready} onClick={save}>
                        Save
                    </Button>
                </>
            }
        >
            <SessionLocationsFields
                workingDir={workingDir}
                contextDir={contextDir}
                onWorkingDirChange={setWorkingDir}
                onContextDirChange={setContextDir}
            />
        </DialogShell>
    )
}
