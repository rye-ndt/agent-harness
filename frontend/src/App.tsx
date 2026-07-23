import {useEffect, useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {
    AgentStatuses,
    AuthAgent,
    InstallAgent,
    KillAgent,
    SendToAgent,
    SpawnAgent,
    SubmitAuthCode,
    UninstallAgent,
} from '../wailsjs/go/wails_api/API'
import {output_itf} from '../wailsjs/go/models'
import {BrowserOpenURL, EventsOn} from '../wailsjs/runtime/runtime'

type InstallProgress = {
    stage: string
    downloaded: number
    total: number
}

type ChatMessage = {
    from: 'user' | 'agent'
    text: string
}

type Instance = {
    harnessId: string
    agentId: string
    messages: ChatMessage[]
    alive: boolean
}

function formatAgentName(name: string) {
    return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function formatProgress(p: InstallProgress) {
    if (p.stage === 'download' && p.total > 0) {
        return `downloading ${Math.round((p.downloaded / p.total) * 100)}%`
    }
    return p.stage
}

function extractAgentText(line: string): {text: string; replace: boolean} | null {
    let evt: any
    try {
        evt = JSON.parse(line)
    } catch {
        return {text: line, replace: false}
    }
    if (evt.type === 'assistant') {
        const parts = evt.message?.content ?? []
        const text = parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('')
        return text ? {text, replace: false} : null
    }
    if (evt.type === 'message.part.updated' && evt.properties?.part?.type === 'text') {
        return {text: evt.properties.part.text, replace: true}
    }
    return null
}

function ChatBox({
    instance,
    onSend,
    onKill,
}: {
    instance: Instance
    onSend: (text: string) => Promise<void>
    onKill: () => void
}) {
    const [draft, setDraft] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollRef.current?.scrollTo({top: scrollRef.current.scrollHeight})
    }, [instance.messages])

    const submit = async () => {
        const text = draft.trim()
        if (!text || !instance.alive) return
        setDraft('')
        await onSend(text)
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle className="text-sm">
                    {formatAgentName(instance.harnessId)} · {instance.agentId}
                </CardTitle>
                <CardDescription>
                    {instance.alive ? 'running' : 'terminated'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <div
                    ref={scrollRef}
                    className="flex max-h-64 min-h-24 flex-col gap-1 overflow-y-auto rounded-md border p-2"
                >
                    {instance.messages.map((m, i) => (
                        <p
                            key={i}
                            className={
                                m.from === 'user'
                                    ? 'self-end rounded-md bg-primary px-2 py-1 text-sm whitespace-pre-wrap text-primary-foreground'
                                    : 'self-start rounded-md bg-muted px-2 py-1 text-sm whitespace-pre-wrap'
                            }
                        >
                            {m.text}
                        </p>
                    ))}
                    {instance.messages.length === 0 && (
                        <p className="text-sm text-muted-foreground">No messages yet.</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={draft}
                        disabled={!instance.alive}
                        placeholder="Message the agent…"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                    />
                    <Button size="sm" disabled={!instance.alive} onClick={submit}>
                        Send
                    </Button>
                    <Button size="sm" variant="destructive" disabled={!instance.alive} onClick={onKill}>
                        Kill
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function App() {
    const [agents, setAgents] = useState<output_itf.AgentInfo[]>([])
    const [instances, setInstances] = useState<Instance[]>([])
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
        refresh()
        const offProgress = EventsOn(
            'harness:install:progress',
            (id: string, p: InstallProgress) => {
                setProgress((prev) => ({...prev, [id]: formatProgress(p)}))
            },
        )
        const offOutput = EventsOn('agent:output', (_: string, agentId: string, line: string) => {
            const extracted = extractAgentText(line)
            if (!extracted) return
            setInstances((prev) =>
                prev.map((inst) => {
                    if (inst.agentId !== agentId) return inst
                    const messages = [...inst.messages]
                    const last = messages[messages.length - 1]
                    if (extracted.replace && last?.from === 'agent') {
                        messages[messages.length - 1] = {from: 'agent', text: extracted.text}
                    } else {
                        messages.push({from: 'agent', text: extracted.text})
                    }
                    return {...inst, messages}
                }),
            )
        })
        const offClosed = EventsOn('agent:closed', (_: string, agentId: string) => {
            setInstances((prev) =>
                prev.map((inst) =>
                    inst.agentId === agentId ? {...inst, alive: false} : inst,
                ),
            )
            refresh()
        })
        return () => {
            offProgress()
            offOutput()
            offClosed()
        }
    }, [])

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

    useEffect(() => {
        if (Object.keys(authUrls).length === 0) return
        const timer = setInterval(refresh, 2000)
        return () => clearInterval(timer)
    }, [authUrls])

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

    const login = (id: string) =>
        run(id, 'logging in', async (harnessId) => {
            const url = await AuthAgent(harnessId)
            if (url) {
                setAuthUrls((prev) => ({...prev, [harnessId]: url}))
            }
        })

    const submitCode = (id: string) => {
        const code = (codeDrafts[id] ?? '').trim()
        if (!code) return
        run(id, 'verifying', async (harnessId) => {
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

    const spawn = (id: string) =>
        run(id, 'spawning', async (harnessId) => {
            const agentId = await SpawnAgent(harnessId)
            setInstances((prev) => [
                ...prev,
                {harnessId, agentId, messages: [], alive: true},
            ])
        })

    const send = async (inst: Instance, text: string) => {
        try {
            await SendToAgent(inst.harnessId, inst.agentId, text)
            setInstances((prev) =>
                prev.map((i) =>
                    i.agentId === inst.agentId
                        ? {...i, messages: [...i.messages, {from: 'user', text}]}
                        : i,
                ),
            )
        } catch (err) {
            setError(String(err))
        }
    }

    const kill = async (inst: Instance) => {
        try {
            await KillAgent(inst.harnessId, inst.agentId)
        } catch (err) {
            setError(String(err))
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center gap-4 bg-background py-8">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>master_harness</CardTitle>
                    <CardDescription>
                        {error || 'Supported agent harness tools'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    {agents.map(({id, status}) => (
                        <div
                            key={id}
                            className="flex flex-col gap-2 rounded-md border px-3 py-2"
                        >
                            <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">
                                    {status?.name || formatAgentName(id)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {status?.installed
                                        ? status.logged_in
                                            ? `v${status.version} · ${status.instance_count} running`
                                            : `v${status.version} · not logged in`
                                        : 'not installed'}
                                </p>
                            </div>
                            {status?.installed ? (
                                <div className="flex gap-2">
                                    {status.logged_in ? (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={id in progress}
                                            onClick={() => spawn(id)}
                                        >
                                            {progress[id] === 'spawning' ? 'spawning' : 'Spawn'}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            disabled={id in progress}
                                            onClick={() => login(id)}
                                        >
                                            {progress[id] === 'logging in'
                                                ? 'logging in'
                                                : 'Log in'}
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={id in progress}
                                        onClick={() => run(id, 'uninstalling', UninstallAgent)}
                                    >
                                        {progress[id] === 'uninstalling'
                                            ? 'uninstalling'
                                            : 'Uninstall'}
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    disabled={id in progress}
                                    onClick={() => run(id, 'starting', InstallAgent)}
                                >
                                    {progress[id] ?? 'Install'}
                                </Button>
                            )}
                            </div>
                            {authUrls[id] && !status?.logged_in && (
                                <div className="flex flex-col gap-2 border-t pt-2">
                                    <p className="text-xs text-muted-foreground">
                                        A login page should have opened in your browser.{' '}
                                        <button
                                            className="underline"
                                            onClick={() => BrowserOpenURL(authUrls[id])}
                                        >
                                            Open it again
                                        </button>{' '}
                                        if it didn't. Most logins finish on their own after you
                                        approve in the browser — only paste a code below if the
                                        page shows you one.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={codeDrafts[id] ?? ''}
                                            placeholder="Authorization code"
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
                                            {progress[id] === 'verifying' ? 'verifying' : 'Submit'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {!error && agents.length === 0 && (
                        <p className="text-sm text-muted-foreground">No agents configured.</p>
                    )}
                </CardContent>
            </Card>
            {instances.map((inst) => (
                <ChatBox
                    key={inst.agentId}
                    instance={inst}
                    onSend={(text) => send(inst, text)}
                    onKill={() => kill(inst)}
                />
            ))}
        </div>
    )
}

export default App
