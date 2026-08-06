import {toAppError, type AppError} from '@/shared/lib/errors'

let reported: AppError[] = []

const listeners = new Set<() => void>()

function fingerprint(error: AppError) {
    return `${error.code}|${error.title}|${error.message}`
}

function publish() {
    for (const listener of listeners) listener()
}

export function reportError(cause: unknown, action = '') {
    const error = toAppError(cause, action)
    if (reported.some((shown) => fingerprint(shown) === fingerprint(error))) return

    reported = [...reported, error]
    publish()
}

export function dismissError(id: string) {
    reported = reported.filter((error) => error.id !== id)
    publish()
}

export function subscribeToErrors(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function reportedErrors() {
    return reported
}
