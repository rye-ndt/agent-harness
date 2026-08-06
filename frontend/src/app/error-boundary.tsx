import {Component, type ReactNode} from 'react'

import {Button} from '@/shared/ui/button'
import {errorReport, toAppError} from '@/shared/lib/errors'

type Props = {children: ReactNode}

type State = {error: unknown}

export class ErrorBoundary extends Component<Props, State> {
    state: State = {error: null}

    static getDerivedStateFromError(error: unknown): State {
        return {error}
    }

    render() {
        if (!this.state.error) return this.props.children

        const error = toAppError(this.state.error, 'The app stopped')

        return (
            <div className="flex h-screen items-center justify-center bg-background p-6 text-foreground">
                <div className="surface-card flex w-full max-w-[520px] flex-col overflow-hidden ring-1 ring-border">
                    <span aria-hidden="true" className="block h-0.5 bg-state-failed" />

                    <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
                        <span className="font-mono text-xs font-semibold tracking-[0.04em] text-destructive">
                            {error.code || 'error'}
                        </span>
                        <p className="text-lg font-medium">{error.title}</p>
                        <p className="text-base break-words">{error.message}</p>
                        <p className="text-sm text-muted-foreground">
                            Reload to start over. Your sessions are saved.
                        </p>
                    </div>

                    <pre className="mx-5 mb-4 max-h-40 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-sm whitespace-pre-wrap">
                        {errorReport(error)}
                    </pre>

                    <div className="flex h-14 shrink-0 items-center justify-end border-t border-border px-5">
                        <Button size="sm" onClick={() => window.location.reload()}>
                            Reload
                        </Button>
                    </div>
                </div>
            </div>
        )
    }
}
