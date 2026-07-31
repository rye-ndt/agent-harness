import {useEffect, useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {cn} from '@/lib/utils'
import {input_itf, output_itf} from '../../../wailsjs/go/models'
import {
    AgentStatuses,
    AuthAgent,
    InstallAgent,
    SubmitAuthCode,
    UninstallAgent,
} from '../../../wailsjs/go/wails_api/API'
import {BrowserOpenURL, EventsOn} from '../../../wailsjs/runtime/runtime'

type InstallProgress = {
    stage: string
    downloaded: number
    total: number
}

function formatAgentName(name: string) {
    return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function formatProgress(p: InstallProgress) {
    if (p.stage === 'download' && p.total > 0) {
        return `Downloading ${Math.round((p.downloaded / p.total) * 100)}%`
    }
    return p.stage
}

function metaLine(status?: input_itf.AgentStatus) {
    if (!status?.installed) return 'Not installed'
    if (!status.logged_in) return `v${status.version} · Not logged in`
    return `v${status.version} · ${status.instance_count} running`
}

function dotClass(status?: input_itf.AgentStatus) {
    if (!status?.installed) return 'bg-transparent ring-1 ring-inset ring-border'
    return status.logged_in ? 'bg-state-done' : 'bg-state-idle'
}

export function AgentsPanel({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [agents, setAgents] = useState<output_itf.AgentInfo[]>([])
    const [progress, setProgress] = useState<Record<string, string>>({})
    const [authUrls, setAuthUrls] = useState<Record<string, string>>({})
    const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({})
    const [error, setError] = useState('')

    const refresh = () => {
        AgentStatuses()
            .then(setAgents)
            .catch((err) => setError(String(err)))
    }

    useEffect(() => {
        if (!open) return
        refresh()
        return EventsOn('harness:install:progress', (id: string, p: InstallProgress) => {
            setProgress((prev) => ({...prev, [id]: formatProgress(p)}))
        })
    }, [open])

    useEffect(() => {
        if (!open || Object.keys(authUrls).length === 0) return
        const timer = setInterval(refresh, 2000)
        return () => clearInterval(timer)
    }, [open, authUrls])

    useEffect(() => {
        setAuthUrls((prev) => {
            const next = {...prev}
            let changed = false
            for (const {id, status} of agents) {
                if (status?.logged_in && id in next) {
                    delete next[id]
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [agents])

    const run = async (id: string, label: string, action: (id: string) => Promise<unknown>) => {
        setError('')
        setProgress((prev) => ({...prev, [id]: label}))
        try {
            await action(id)
        } catch (err) {
            setError(String(err))
        }
        setProgress((prev) => {
            const next = {...prev}
            delete next[id]
            return next
        })
        refresh()
    }

    const login = (id: string) =>
        run(id, 'Logging in', async (harnessId) => {
            const url = await AuthAgent(harnessId)
            if (url) {
                setAuthUrls((prev) => ({...prev, [harnessId]: url}))
            }
        })

    const submitCode = (id: string) => {
        const code = (codeDrafts[id] ?? '').trim()
        if (!code) return
        run(id, 'Verifying', async (harnessId) => {
            await SubmitAuthCode(harnessId, code)
            setAuthUrls((prev) => {
                const next = {...prev}
                delete next[harnessId]
                return next
            })
            setCodeDrafts((prev) => {
                const next = {...prev}
                delete next[harnessId]
                return next
            })
        })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[420px] gap-0 bg-sidebar p-0 sm:max-w-[420px]"
            >
                <SheetHeader className="border-b border-border px-4 py-3">
                    <SheetTitle className="text-[0.9375rem]">Agents</SheetTitle>
                    <SheetDescription className="text-xs">
                        Installed agent CLIs. Shared by every session.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto">
                    {agents.map(({id, status}) => (
                        <div key={id} className="flex flex-col gap-2 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <span
                                    className={cn('size-2 shrink-0 rounded-full', dotClass(status))}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="truncate text-[0.8125rem] font-medium">
                                        {status?.name || formatAgentName(id)}
                                    </p>
                                    <p className="truncate font-mono text-xs text-muted-foreground">
                                        {metaLine(status)}
                                    </p>
                                </div>
                                {status?.installed ? (
                                    <div className="flex shrink-0 gap-1.5">
                                        {!status.logged_in && (
                                            <Button
                                                size="sm"
                                                disabled={id in progress}
                                                onClick={() => login(id)}
                                            >
                                                {progress[id] === 'Logging in'
                                                    ? 'Logging in'
                                                    : 'Log in'}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            disabled={id in progress}
                                            onClick={() => run(id, 'Uninstalling', UninstallAgent)}
                                        >
                                            {progress[id] === 'Uninstalling'
                                                ? 'Uninstalling'
                                                : 'Uninstall'}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="shrink-0"
                                        disabled={id in progress}
                                        onClick={() => run(id, 'Starting', InstallAgent)}
                                    >
                                        {progress[id] ?? 'Install'}
                                    </Button>
                                )}
                            </div>

                            {authUrls[id] && !status?.logged_in && (
                                <div className="flex flex-col gap-2 rounded-md bg-background p-2.5 ring-1 ring-border">
                                    <p className="text-xs text-muted-foreground">
                                        A login page opened in your browser.{' '}
                                        <button
                                            className="underline underline-offset-2 hover:text-foreground"
                                            onClick={() => BrowserOpenURL(authUrls[id])}
                                        >
                                            Open it again
                                        </button>{' '}
                                        if it didn't. Most logins finish on their own once you
                                        approve. Paste a code below only if the page shows you one.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={codeDrafts[id] ?? ''}
                                            placeholder="Authorization code"
                                            className="font-mono text-[0.8125rem]"
                                            onChange={(e) =>
                                                setCodeDrafts((prev) => ({
                                                    ...prev,
                                                    [id]: e.target.value,
                                                }))
                                            }
                                            onKeyDown={(e) => e.key === 'Enter' && submitCode(id)}
                                        />
                                        <Button
                                            size="sm"
                                            disabled={
                                                id in progress || !(codeDrafts[id] ?? '').trim()
                                            }
                                            onClick={() => submitCode(id)}
                                        >
                                            {progress[id] === 'Verifying' ? 'Verifying' : 'Submit'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {agents.length === 0 && !error && (
                        <p className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
                            No agents configured. Add one to config.yaml to see it here.
                        </p>
                    )}
                </div>

                {error && (
                    <p className="border-t border-border px-4 py-3 text-xs text-destructive">
                        {error}
                    </p>
                )}
            </SheetContent>
        </Sheet>
    )
}
