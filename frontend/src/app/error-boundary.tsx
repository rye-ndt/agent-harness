import {Component, type ReactNode} from 'react'

import {Button} from '@/shared/ui/button'
import {errorMessage} from '@/shared/lib/errors'

type Props = {children: ReactNode}

type State = {error: unknown}

export class ErrorBoundary extends Component<Props, State> {
    state: State = {error: null}

    static getDerivedStateFromError(error: unknown): State {
        return {error}
    }

    render() {
        if (!this.state.error) return this.props.children

        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
                    <p className="text-base">Something went wrong.</p>
                    <p className="font-mono text-sm text-muted-foreground">
                        {errorMessage(this.state.error)}
                    </p>
                    <Button size="sm" onClick={() => window.location.reload()}>
                        Reload
                    </Button>
                </div>
            </div>
        )
    }
}
