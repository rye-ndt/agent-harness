import {DialogShell} from '@/components/common/dialog-shell'
import {StateBadge} from '@/components/common/task-state'
import {ContextDonut} from '@/components/inspector/context-donut'
import {FileChanges} from '@/components/inspector/file-changes'
import {HandoverDocs} from '@/components/inspector/handover-docs'
import {Button} from '@/components/ui/button'
import {useElapsed} from '@/hooks/use-elapsed'
import {useTemplates} from '@/hooks/use-templates'
import {formatAgentName} from '@/lib/agent'
import {TASK_LEVEL_LABELS} from '@/lib/template'
import type {Task} from '@/types/session'
import type {Template} from '@/types/template'

function formatMoment(iso?: string) {
    if (!iso) return '—'

    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function summarize(task: Task, template?: Template) {
    return [
        template?.name,
        template && TASK_LEVEL_LABELS[template.taskLevel],
        formatAgentName(task.agent),
    ]
        .filter(Boolean)
        .join(' · ')
}

function Stat({label, value}: {label: string; value: string}) {
    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
            <span className="micro-label">{label}</span>
            <span className="truncate font-mono text-base">{value}</span>
        </div>
    )
}

export function TaskStatusDialog({task, onClose}: {task: Task; onClose: () => void}) {
    const {templates} = useTemplates()
    const template = templates.find((template) => template.id === task.templateId)
    const run = task.run
    const context = run?.context
    const elapsed = useElapsed(run?.startedAt, run?.finishedAt)
    const percent =
        context && context.total > 0
            ? Math.round(Math.min(1, context.used / context.total) * 100)
            : 0

    return (
        <DialogShell
            open
            onOpenChange={(open) => !open && onClose()}
            title={task.title || 'Untitled node'}
            description={summarize(task, template)}
            aside={<StateBadge state={task.state} />}
            footer={
                <>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                        {task.id}
                    </span>
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </>
            }
        >
            {run ? (
                <div className="divide-y divide-border">
                    <div className="grid grid-cols-2 gap-2 px-4 py-4">
                        <Stat label="Started" value={formatMoment(run.startedAt)} />
                        <Stat label="Finished" value={formatMoment(run.finishedAt)} />
                        <Stat label="Elapsed" value={elapsed ?? '—'} />
                        {run.retryCount !== undefined && run.retryCount > 0 && (
                            <Stat label="Retries" value={String(run.retryCount)} />
                        )}
                    </div>

                    {context && (
                        <div className="flex items-center gap-4 px-4 py-4">
                            <ContextDonut used={context.used} total={context.total} />
                            <div className="flex min-w-0 flex-col gap-2">
                                <span className="micro-label">Context</span>
                                <span className="font-mono text-lg leading-none">
                                    {percent}%
                                </span>
                            </div>
                        </div>
                    )}

                    {task.report ? (
                        <>
                            <div className="px-4 py-4">
                                <FileChanges changes={task.report.fileChanges} />
                            </div>
                            <div className="px-4 py-4">
                                <HandoverDocs docs={task.report.handoverDocs} />
                            </div>
                        </>
                    ) : (
                        <p className="px-4 py-4 text-base text-muted-foreground">
                            The report lands when this node stops.
                        </p>
                    )}
                </div>
            ) : (
                <p className="px-4 py-4 text-base text-muted-foreground">
                    {task.state === 'blocked'
                        ? 'This node has not run. It is waiting on the nodes upstream of it.'
                        : 'This node has not run yet.'}
                </p>
            )}
        </DialogShell>
    )
}
