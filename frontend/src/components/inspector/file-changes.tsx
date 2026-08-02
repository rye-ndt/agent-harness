import {ReportSection} from '@/components/inspector/report-section'
import {FileChangeType} from '@/lib/enums'
import {cn} from '@/lib/utils'
import type {FileChange} from '@/types/session'

function lineTone(line: string) {
    if (line.startsWith('+++') || line.startsWith('---')) return 'text-muted-foreground/70'
    if (line.startsWith('@@')) return 'bg-muted text-muted-foreground'
    if (line.startsWith('+')) return 'bg-state-done-tint text-state-done'
    if (line.startsWith('-')) return 'bg-state-failed-tint text-state-failed'
    return 'text-muted-foreground'
}

function changePath(change: FileChange) {
    const renamed = change.changeType === FileChangeType.Renamed && change.oldPath
    return renamed ? `${change.oldPath} → ${change.path}` : change.path
}

function Counts({additions, deletions}: {additions: number; deletions: number}) {
    return (
        <span className="shrink-0 font-mono text-xs">
            <span className="text-state-done">+{additions}</span>{' '}
            <span className="text-state-failed">−{deletions}</span>
        </span>
    )
}

function FileDiff({change}: {change: FileChange}) {
    return (
        <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <span className="micro-label shrink-0">{change.changeType}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                    {changePath(change)}
                </span>
                <Counts additions={change.additions} deletions={change.deletions} />
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-max py-2">
                    {change.unifiedDiff.split('\n').map((line, index) => (
                        <span
                            key={index}
                            className={cn(
                                'block px-3 font-mono text-xs leading-[1.7] whitespace-pre',
                                lineTone(line),
                            )}
                        >
                            {line || ' '}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function FileChanges({changes}: {changes: FileChange[]}) {
    const additions = changes.reduce((total, change) => total + change.additions, 0)
    const deletions = changes.reduce((total, change) => total + change.deletions, 0)

    return (
        <ReportSection
            label="Files changed"
            count={changes.length}
            empty="None. This node wrote nothing."
            trailing={<Counts additions={additions} deletions={deletions} />}
        >
            {changes.map((change) => (
                <FileDiff key={`${change.oldPath}${change.path}`} change={change} />
            ))}
        </ReportSection>
    )
}
