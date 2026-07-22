import {useEffect, useState} from 'react'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {SupportedAgents} from '../wailsjs/go/wailsapi/API'

function formatAgentName(name: string) {
    return name
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function App() {
    const [agents, setAgents] = useState<string[]>([])
    const [error, setError] = useState('')

    useEffect(() => {
        SupportedAgents()
            .then(setAgents)
            .catch((err) => setError(String(err)))
    }, [])

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>master_harness</CardTitle>
                    <CardDescription>
                        {error || 'Supported agent harness tools'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    {agents.map((agent) => (
                        <div
                            key={agent}
                            className="rounded-md border px-3 py-2 text-sm font-medium"
                        >
                            {formatAgentName(agent)}
                        </div>
                    ))}
                    {!error && agents.length === 0 && (
                        <p className="text-sm text-muted-foreground">No agents configured.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default App
