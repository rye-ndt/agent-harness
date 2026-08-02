import type {ReactNode} from 'react'

import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'

export function DialogShell({
    open,
    onOpenChange,
    title,
    description,
    aside,
    footer,
    children,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    aside?: ReactNode
    footer: ReactNode
    children: ReactNode
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...(description ? {} : {'aria-describedby': undefined})}
                className="flex h-[600px] max-w-[560px] flex-col gap-0 overflow-hidden p-0"
            >
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 pr-12">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <DialogTitle className="truncate">{title}</DialogTitle>
                        {description && (
                            <DialogDescription className="truncate">
                                {description}
                            </DialogDescription>
                        )}
                    </div>
                    {aside}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

                <div className="flex h-14 shrink-0 items-center gap-2 border-t border-border px-4">
                    {footer}
                </div>
            </DialogContent>
        </Dialog>
    )
}
