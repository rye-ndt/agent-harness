import {useState} from 'react'
import {ArrowLeft} from 'lucide-react'

import {DialogShell} from '@/shared/components/dialog-shell'
import {StepSpine} from '@/shared/components/step-spine'
import {RequiredAgents} from '@/features/sessions/components/required-agents'
import {
    CONTEXT_SUFFIX,
    SessionLocationsFields,
} from '@/features/sessions/components/session-locations'
import {Button} from '@/shared/ui/button'
import {useRequiredAgents} from '@/features/sessions/use-required-agents'
import type {SessionLocations} from '@/features/sessions/types'

const STEP_COUNT = 2

export function NewSessionDialog({
    onCreate,
    onClose,
}: {
    onCreate: (locations: SessionLocations) => void
    onClose: () => void
}) {
    const agents = useRequiredAgents()

    const [onAgentStep, setOnAgentStep] = useState(false)
    const [workingDir, setWorkingDir] = useState('')
    const [contextDir, setContextDir] = useState('')
    const [contextEdited, setContextEdited] = useState(false)

    const locations = {workingDir: workingDir.trim(), contextDir: contextDir.trim()}
    const located = locations.workingDir.length > 0 && locations.contextDir.length > 0

    const changeWorkingDir = (path: string) => {
        setWorkingDir(path)
        if (!contextEdited) setContextDir(`${path}${CONTEXT_SUFFIX}`)
    }

    const changeContextDir = (path: string) => {
        setContextEdited(true)
        setContextDir(path)
    }

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const create = () => {
        if (!located || !agents.ready) return
        onCreate(locations)
    }

    return (
        <DialogShell
            open
            onOpenChange={close}
            title="New session"
            description={
                onAgentStep ? 'The agents this session will run on.' : 'Where this session runs.'
            }
            aside={<StepSpine total={STEP_COUNT} current={onAgentStep ? 1 : 0} />}
            footer={
                onAgentStep ? (
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setOnAgentStep(false)}>
                            <ArrowLeft />
                            Directories
                        </Button>
                        <span className="flex-1" />
                        <Button size="sm" disabled={!agents.ready} onClick={create}>
                            Create session
                        </Button>
                    </>
                ) : (
                    <>
                        <span className="flex-1" />
                        <Button variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button size="sm" disabled={!located} onClick={() => setOnAgentStep(true)}>
                            Continue
                        </Button>
                    </>
                )
            }
        >
            {onAgentStep ? (
                <>
                    <RequiredAgents
                        required={agents.required}
                        loading={agents.loading}
                        actions={{
                            busy: agents.busy,
                            busyLabel: agents.busyLabel,
                            authUrlOf: agents.authUrlOf,
                            onInstall: agents.install,
                            onLogIn: agents.logIn,
                            onSubmitCode: agents.submitAuthCode,
                            onOpenAuthUrl: agents.openAuthUrl,
                        }}
                    />

                    {agents.error && (
                        <p className="border-t border-border bg-state-failed-tint px-4 py-3 text-sm text-destructive">
                            {agents.error}
                        </p>
                    )}
                </>
            ) : (
                <SessionLocationsFields
                    workingDir={workingDir}
                    contextDir={contextDir}
                    onWorkingDirChange={changeWorkingDir}
                    onContextDirChange={changeContextDir}
                />
            )}
        </DialogShell>
    )
}
