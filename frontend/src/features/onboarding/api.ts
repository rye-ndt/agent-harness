/**
 * The only place the generated Wails bindings for onboarding are touched.
 * Onboarding is a once-per-machine event, so the flag lives in the Go user
 * config: uninstalling a harness later must not drag the welcome modal back.
 * Under the plain vite dev server there is no Go side, so it lives in this
 * module's memory — start with ?onboarded=1 to reach the settled app directly.
 */

import {bridge, hasWailsRuntime} from '@/shared/api/bridge'
import {CompleteOnboarding, Onboarded} from '@wailsjs/go/wails_api/API'

let onboarded = new URLSearchParams(window.location.search).get('onboarded') === '1'

export async function hasOnboarded(): Promise<boolean> {
    if (!hasWailsRuntime()) return onboarded

    return bridge(Onboarded)
}

export async function completeOnboarding(): Promise<void> {
    if (!hasWailsRuntime()) {
        onboarded = true
        return
    }

    await bridge(CompleteOnboarding)
}
