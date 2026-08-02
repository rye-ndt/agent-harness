/**
 * The only place the generated Wails bindings are touched. They dereference
 * window.go synchronously, so outside the Wails webview they throw instead of
 * rejecting — every call goes through `bridge` to land as a rejected promise.
 */

import {formatAgentName} from '@/lib/format'
import type {Agent, InstallProgress} from '@/types/agent'
import {
    AgentStatuses,
    AuthAgent,
    InstallAgent,
    SubmitAuthCode,
    UninstallAgent,
} from '../../wailsjs/go/wails_api/API'
import {BrowserOpenURL, EventsOn} from '../../wailsjs/runtime/runtime'

const INSTALL_PROGRESS_EVENT = 'harness:install:progress'

const noop = () => {}

async function bridge<T>(call: () => Promise<T>): Promise<T> {
    return call()
}

export async function listAgents(): Promise<Agent[]> {
    const infos = await bridge(AgentStatuses)

    return infos.map(({id, status}) => ({
        id,
        name: status?.name || formatAgentName(id),
        version: status?.version ?? '',
        installed: status?.installed ?? false,
        loggedIn: status?.logged_in ?? false,
        instanceCount: status?.instance_count ?? 0,
    }))
}

export async function installAgent(agentId: string): Promise<void> {
    await bridge(() => InstallAgent(agentId))
}

export async function uninstallAgent(agentId: string): Promise<void> {
    await bridge(() => UninstallAgent(agentId))
}

export async function startAgentLogin(agentId: string): Promise<string> {
    return bridge(() => AuthAgent(agentId))
}

export async function submitAgentAuthCode(agentId: string, code: string): Promise<void> {
    await bridge(() => SubmitAuthCode(agentId, code))
}

export function onInstallProgress(
    listener: (agentId: string, progress: InstallProgress) => void,
): () => void {
    try {
        return EventsOn(INSTALL_PROGRESS_EVENT, listener)
    } catch {
        return noop
    }
}

export function openExternalURL(url: string) {
    try {
        BrowserOpenURL(url)
    } catch {
        window.open(url, '_blank', 'noopener')
    }
}
