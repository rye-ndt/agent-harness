export function errorMessage(error: unknown): string {
    if (!error) return ''
    return error instanceof Error ? error.message : String(error)
}
