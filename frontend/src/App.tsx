import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Greet} from '../wailsjs/go/wailsapi/API'

function App() {
    const [name, setName] = useState('')
    const [result, setResult] = useState('')

    async function greet() {
        if (!name) return
        setResult(await Greet(name))
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>master_harness</CardTitle>
                    <CardDescription>
                        {result || 'Enter your name and say hello to Go.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && greet()}
                        placeholder="Your name"
                    />
                    <Button onClick={greet}>Greet</Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default App
