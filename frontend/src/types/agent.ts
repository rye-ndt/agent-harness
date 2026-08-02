export type Agent = {
    id: string
    name: string
    version: string
    installed: boolean
    loggedIn: boolean
    instanceCount: number
}

export type AgentOption = {
    id: string
    name: string
    blurb: string
}

export type InstallProgress = {
    stage: string
    downloaded: number
    total: number
}
