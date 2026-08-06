import {useEffect, useState} from 'react'
import {Check, ChevronRight, Copy} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/shared/ui/collapsible'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/shared/ui/dialog'
import {errorReport, type AppError} from '@/shared/lib/errors'
import {formatMoment, pluralize} from '@/shared/lib/format'
import {cn} from '@/shared/lib/utils'

const COPIED_MS = 2000

export function ErrorDialog({
    error,
    queued,
    onDismiss,
}: {
    error: AppError
    queued: number
    onDismiss: () => void
}) {
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!copied) return

        const timer = setTimeout(() => setCopied(false), COPIED_MS)
        return () => clearTimeout(timer)
    }, [copied])

    const close = (open: boolean) => {
        if (!open) onDismiss()
    }

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(errorReport(error))
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }

    return (
        <Dialog open onOpenChange={close}>
            <DialogContent
                showCloseButton={false}
                className="max-w-[520px] gap-0 overflow-hidden p-0"
            >
                <span aria-hidden="true" className="block h-0.5 bg-state-failed" />

                <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
                    <span className="font-mono text-xs font-semibold tracking-[0.04em] text-destructive">
                        {error.code || 'error'}
                    </span>

                    <DialogTitle className="break-words">{error.title}</DialogTitle>

                    <DialogDescription className="text-base break-words text-foreground">
                        {error.message}
                    </DialogDescription>

                    {error.hint && <p className="text-sm text-muted-foreground">{error.hint}</p>}
                </div>

                <Collapsible
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    className="border-t border-dashed border-border-strong"
                >
                    <div className="flex items-center gap-2 px-5 py-2">
                        <CollapsibleTrigger className="w-auto px-1">
                            <ChevronRight
                                className={cn(
                                    'size-3.5 text-muted-foreground transition-transform',
                                    detailsOpen && 'rotate-90',
                                )}
                            />
                            <span className="micro-label">Details</span>
                        </CollapsibleTrigger>

                        <span className="flex-1" />

                        <Button variant="ghost" size="xs" onClick={copy}>
                            {copied ? <Check /> : <Copy />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>

                    <CollapsibleContent>
                        <div className="mx-5 mb-4 rounded-lg bg-muted">
                            <dl className="flex flex-col gap-1 px-3 py-2">
                                <DetailRow label="Code" value={error.code || '—'} />
                                <DetailRow label="Level" value={error.severity} />
                                <DetailRow label="Time" value={formatMoment(error.at)} />
                            </dl>

                            <pre className="max-h-40 overflow-auto border-t border-border px-3 py-2 font-mono text-sm whitespace-pre-wrap">
                                {error.detail}
                            </pre>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                <DialogFooter className="h-14 border-t border-border px-5">
                    {queued > 0 && (
                        <span className="micro-label flex-1">
                            {pluralize(queued, 'more error')}
                        </span>
                    )}
                    <Button autoFocus size="sm" onClick={onDismiss}>
                        Dismiss
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DetailRow({label, value}: {label: string; value: string}) {
    return (
        <div className="flex items-baseline gap-3">
            <dt className="micro-label w-12 shrink-0">{label}</dt>
            <dd className="min-w-0 flex-1 font-mono text-sm break-all">{value}</dd>
        </div>
    )
}
