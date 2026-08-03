import type {InstallStage} from '@/lib/enums'

export type Agent = {
    id: string
    name: string
    version: string
    installed: boolean
    loggedIn: boolean
    instanceCount: number
}

export type InstallProgress = {
    stage: InstallStage
    downloaded: number
    total: number
}

export type Dependency = {
    id: string
    name: string
    version: string
    stage: InstallStage
    progress: InstallProgress | null
    failed: boolean
}
