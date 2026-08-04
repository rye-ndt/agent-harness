import {ReportSection} from '@/features/sessions/components/inspector/report-section'
import type {HandoverDoc} from '@/features/sessions/types'

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
    return (
        <ReportSection
            label="Handover"
            count={docs.length}
            empty="None. Nothing was carried forward."
            trailing={<span className="text-sm text-muted-foreground">Goes to the next node</span>}
        >
            {docs.map((doc, index) => (
                <p
                    key={index}
                    className="rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs leading-[1.8] whitespace-pre-wrap"
                >
                    {docText(doc)}
                </p>
            ))}
        </ReportSection>
    )
}
