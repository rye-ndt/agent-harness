/**
 * The generated Wails bindings dereference window.go synchronously, so outside
 * the Wails webview they throw instead of rejecting — every binding call goes
 * through `bridge` to land as a rejected promise instead.
 */

export async function bridge<T>(call: () => Promise<T>): Promise<T> {
    return call()
}

export function hasWailsRuntime() {
    try {
        const bindings = window as Window & {go?: {wails_api?: {API?: object}}}
        return Boolean(bindings.go?.wails_api?.API)
    } catch {
        return false
    }
}
