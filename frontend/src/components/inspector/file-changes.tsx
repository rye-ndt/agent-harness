import {useState} from 'react'
import {ChevronRight} from 'lucide-react'

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {cn} from '@/lib/utils'
import type {FileChange} from '@/types/session'

function lineTone(line: string) {
    if (line.startsWith('+++') || line.startsWith('---')) return 'text-muted-foreground/70'
    if (line.startsWith('@@')) return 'bg-muted text-muted-foreground'
    if (line.startsWith('+')) return 'bg-state-done-tint text-state-done'
    if (line.startsWith('-')) return 'bg-state-failed-tint text-state-failed'
    return 'text-muted-foreground'
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
                    {change.changeType === 'renamed' && change.oldPath
                        ? `${change.oldPath} → ${change.path}`
                        : change.path}
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
    const [open, setOpen] = useState(false)

    const additions = changes.reduce((total, change) => total + change.additions, 0)
    const deletions = changes.reduce((total, change) => total + change.deletions, 0)

    if (changes.length === 0)
        return (
            <div className="flex items-center gap-2 py-1">
                <span className="size-3.5 shrink-0" />
                <span className="micro-label">Files changed</span>
                <span className="text-sm text-muted-foreground">None. This node wrote nothing.</span>
            </div>
        )

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger>
                <ChevronRight
                    aria-hidden="true"
                    className={cn(
                        'size-3.5 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none',
                        open && 'rotate-90',
                    )}
                />
                <span className="micro-label">Files changed</span>
                <span className="font-mono text-sm text-muted-foreground">{changes.length}</span>
                <span className="flex-1" />
                <Counts additions={additions} deletions={deletions} />
            </CollapsibleTrigger>

            <CollapsibleContent className="flex flex-col gap-2 pt-3">
                {changes.map((change) => (
                    <FileDiff key={`${change.oldPath}${change.path}`} change={change} />
                ))}
            </CollapsibleContent>
        </Collapsible>
    )
}
