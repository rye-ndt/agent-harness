import {useState} from 'react'
import {ChevronRight} from 'lucide-react'

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {cn} from '@/lib/utils'
import type {HandoverDoc} from '@/types/session'

type MapField = Exclude<keyof HandoverDoc, 'task' | 'outcome'>

const MAP_FIELDS: [MapField, string][] = [
    ['blockers', 'Blockers'],
    ['approvedDecisions', 'Approved decisions'],
    ['rejectedDecisions', 'Rejected decisions'],
    ['currentBehaviors', 'Current behaviors'],
    ['changedBehaviors', 'Changed behaviors'],
    ['mustAvoid', 'Must avoid'],
    ['nuances', 'Nuances'],
    ['knownGaps', 'Known gaps'],
]

function docText(doc: HandoverDoc) {
    const blocks = [`TASK\n${doc.task}`, `OUTCOME\n${doc.outcome}`]

    for (const [field, label] of MAP_FIELDS) {
        const entries = Object.entries(doc[field])
        if (entries.length === 0) continue

        const lines = entries.map(([key, value]) => `${key}: ${value}`).join('\n')
        blocks.push(`${label.toUpperCase()}\n${lines}`)
    }

    return blocks.join('\n\n')
}

export function HandoverDocs({docs}: {docs: HandoverDoc[]}) {
    const [open, setOpen] = useState(false)

    if (docs.length === 0)
        return (
            <div className="flex items-center gap-2 py-1">
                <span className="size-3.5 shrink-0" />
                <span className="micro-label">Handover</span>
                <span className="text-sm text-muted-foreground">
                    None. Nothing was carried forward.
                </span>
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
                <span className="micro-label">Handover</span>
                <span className="font-mono text-sm text-muted-foreground">{docs.length}</span>
                <span className="flex-1" />
                <span className="text-sm text-muted-foreground">Goes to the next node</span>
            </CollapsibleTrigger>

            <CollapsibleContent className="flex flex-col gap-2 pt-3">
                {docs.map((doc, index) => (
                    <p
                        key={index}
                        className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-[1.8] whitespace-pre-wrap"
                    >
                        {docText(doc)}
                    </p>
                ))}
            </CollapsibleContent>
        </Collapsible>
    )
}
