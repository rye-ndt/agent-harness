import type {ReactNode} from 'react'

import {cn} from '@/lib/utils'

export function Field({
    htmlFor,
    label,
    hint,
    className,
    children,
}: {
    htmlFor: string
    label: string
    hint?: string
    className?: string
    children: ReactNode
}) {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <label htmlFor={htmlFor} className="text-base font-medium">
                {label}
            </label>
            {children}
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
    )
}
