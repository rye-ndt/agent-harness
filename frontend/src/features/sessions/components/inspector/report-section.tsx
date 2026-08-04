import {useState, type ReactNode} from 'react'
import {ChevronRight} from 'lucide-react'

import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/shared/ui/collapsible'
import {cn} from '@/shared/lib/utils'

export function ReportSection({
    label,
    count,
    empty,
    trailing,
    children,
}: {
    label: string
    count: number
    empty: string
    trailing?: ReactNode
    children: ReactNode
}) {
    const [open, setOpen] = useState(false)

    if (count === 0)
        return (
            <div className="flex items-center gap-2 py-1">
                <span className="size-3.5 shrink-0" />
                <span className="micro-label">{label}</span>
                <span className="text-sm text-muted-foreground">{empty}</span>
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
                <span className="micro-label">{label}</span>
                <span className="font-mono text-sm text-muted-foreground">{count}</span>
                <span className="flex-1" />
                {trailing}
            </CollapsibleTrigger>

            <CollapsibleContent className="flex flex-col gap-2 pt-3">{children}</CollapsibleContent>
        </Collapsible>
    )
}
