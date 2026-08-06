import {DependencyRow} from '@/features/onboarding/components/dependency-row'
import {Button} from '@/shared/ui/button'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/shared/ui/dialog'
import {Progress} from '@/shared/ui/progress'
import type {Dependency} from '@/features/agents/types'

const stayOpen = (event: Event | KeyboardEvent) => event.preventDefault()

export function WelcomeDialog({
    dependencies,
    ratio,
    settled,
    canContinue,
    failed,
    onRetry,
    onStart,
}: {
    dependencies: Dependency[]
    ratio: number
    settled: boolean
    canContinue: boolean
    failed: boolean
    onRetry: () => void
    onStart: () => void
}) {
    const percent = Math.round(ratio * 100)

    const label = failed
        ? 'Some dependencies failed'
        : settled
          ? 'Dependencies ready'
          : 'Installing dependencies…'

    return (
        <Dialog open>
            <DialogContent
                showCloseButton={false}
                className="flex flex-col gap-6 rounded-[20px] bg-card p-8 outline-none sm:max-w-lg"
                onEscapeKeyDown={stayOpen}
                onPointerDownOutside={stayOpen}
                onInteractOutside={stayOpen}
            >
                <DialogHeader className="gap-2">
                    <span className="micro-label">Welcome</span>
                    <DialogTitle className="text-xl">Install Dependencies</DialogTitle>
                </DialogHeader>

                <div className="divide-y divide-border rounded-xl border border-border">
                    {dependencies.map((dependency) => (
                        <DependencyRow key={dependency.id} dependency={dependency} />
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {percent}%
                        </span>
                    </div>

                    <Progress
                        aria-label={label}
                        value={percent}
                        className="h-2 rounded-full bg-progress-track"
                        indicatorClassName={failed ? 'bg-state-failed' : 'bg-progress'}
                    />
                </div>

                {failed && canContinue && (
                    <p className="text-sm text-muted-foreground">
                        You can start with the harnesses that are ready.
                    </p>
                )}

                {(settled || failed) && (
                    <DialogFooter>
                        {failed && (
                            <Button
                                autoFocus={!canContinue}
                                variant="outline"
                                className="min-w-36"
                                onClick={onRetry}
                            >
                                Try again
                            </Button>
                        )}
                        {canContinue && (
                            <Button autoFocus className="min-w-36" onClick={onStart}>
                                Start building
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
