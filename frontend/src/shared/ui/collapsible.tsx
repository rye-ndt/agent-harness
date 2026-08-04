import * as React from 'react'
import {Collapsible as CollapsiblePrimitive} from 'radix-ui'

import {cn} from '@/shared/lib/utils'

function Collapsible({...props}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
    return (
        <CollapsiblePrimitive.Trigger
            data-slot="collapsible-trigger"
            className={cn(
                'flex w-full items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
                className,
            )}
            {...props}
        />
    )
}

function CollapsibleContent({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
    return (
        <CollapsiblePrimitive.Content
            data-slot="collapsible-content"
            className={cn('overflow-hidden', className)}
            {...props}
        />
    )
}

export {Collapsible, CollapsibleContent, CollapsibleTrigger}
