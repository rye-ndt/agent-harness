import {DialogShell} from '@/shared/components/dialog-shell'
import {Button} from '@/shared/ui/button'
import {pluralize} from '@/shared/lib/format'
import type {MissingNodeInputs} from '@/features/sessions/task-inputs'

export function MissingInputsDialog({
    entries,
    onSelectTask,
    onClose,
}: {
    entries: MissingNodeInputs[]
    onSelectTask: (taskId: string) => void
    onClose: () => void
}) {
    const close = (open: boolean) => {
        if (!open) onClose()
    }

    return (
        <DialogShell
            open
            onOpenChange={close}
            title="Fill inputs before the run"
            description={`Inputs are missing on ${pluralize(entries.length, 'node')}. Pick one to fill them, then run.`}
            footer={
                <>
                    <span className="flex-1" />
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-2 p-4">
                {entries.map((entry) => (
                    <MissingRow key={entry.task.id} entry={entry} onSelect={onSelectTask} />
                ))}
            </div>
        </DialogShell>
    )
}

function MissingRow({
    entry,
    onSelect,
}: {
    entry: MissingNodeInputs
    onSelect: (taskId: string) => void
}) {
    const select = () => onSelect(entry.task.id)

    return (
        <button
            type="button"
            onClick={select}
            className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-live"
        >
            <span className="truncate text-base font-medium">
                {entry.task.title || 'Untitled node'}
            </span>

            <span className="flex flex-wrap gap-1.5">
                {entry.params.map((param) => (
                    <span
                        key={param.key}
                        className="rounded-sm bg-state-approval-tint px-2 py-0.5 font-mono text-xs text-state-approval"
                    >
                        {param.label.trim() || param.key}
                    </span>
                ))}
            </span>
        </button>
    )
}
