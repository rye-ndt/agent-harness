import type {ReactNode} from 'react'
import {QueryClientProvider} from '@tanstack/react-query'

import {ErrorBoundary} from '@/app/error-boundary'
import {queryClient} from '@/app/query-client'
import {ErrorHost} from '@/shared/components/error-host'
import {TooltipProvider} from '@/shared/ui/tooltip'

const TOOLTIP_DELAY_MS = 300

export function AppProviders({children}: {children: ReactNode}) {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
                    {children}
                    <ErrorHost />
                </TooltipProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    )
}
