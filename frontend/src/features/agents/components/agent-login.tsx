import {useState, type ChangeEvent, type KeyboardEvent} from 'react'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'

export function AgentLogin({
    agentId,
    authUrl,
    busy,
    verifying,
    onSubmitCode,
    onOpenAuthUrl,
}: {
    agentId: string
    authUrl: string
    busy: boolean
    verifying: boolean
    onSubmitCode: (agentId: string, code: string) => void
    onOpenAuthUrl: (url: string) => void
}) {
    const [code, setCode] = useState('')

    const trimmed = code.trim()
    const canSubmit = trimmed.length > 0 && !busy

    const submit = () => {
        if (!canSubmit) return

        onSubmitCode(agentId, trimmed)
        setCode('')
    }

    const openUrl = () => onOpenAuthUrl(authUrl)

    const changeCode = (event: ChangeEvent<HTMLInputElement>) => setCode(event.target.value)

    const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') submit()
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
            <p className="text-sm text-muted-foreground">
                A login page opened in your browser.{' '}
                <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={openUrl}
                >
                    Open it again
                </button>{' '}
                if it didn't. Most logins finish on their own once you approve. Paste a code below
                only if the page shows you one.
            </p>

            <div className="flex gap-2">
                <Input
                    value={code}
                    placeholder="Authorization code"
                    aria-label="Authorization code"
                    className="bg-background font-mono"
                    onChange={changeCode}
                    onKeyDown={submitOnEnter}
                />
                <Button size="sm" disabled={!canSubmit} onClick={submit}>
                    {verifying ? 'Verifying' : 'Submit'}
                </Button>
            </div>
        </div>
    )
}
