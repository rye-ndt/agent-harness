import {useSyncExternalStore} from 'react'

import {ErrorDialog} from '@/shared/components/error-dialog'
import {dismissError, reportedErrors, subscribeToErrors} from '@/shared/lib/error-bus'

export function ErrorHost() {
    const errors = useSyncExternalStore(subscribeToErrors, reportedErrors)
    const [current] = errors

    if (!current) return null

    return (
        <ErrorDialog
            key={current.id}
            error={current}
            queued={errors.length - 1}
            onDismiss={() => dismissError(current.id)}
        />
    )
}
