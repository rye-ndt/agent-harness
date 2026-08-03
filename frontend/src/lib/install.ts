import {InstallStage} from '@/lib/enums'
import {clampRatio} from '@/lib/format'
import type {Dependency, InstallProgress} from '@/types/agent'

const STAGE_FLOOR: Record<InstallStage, number> = {
    [InstallStage.Queued]: 0,
    [InstallStage.Resolve]: 0.05,
    [InstallStage.Download]: 0.1,
    [InstallStage.Extract]: 0.9,
    [InstallStage.Done]: 1,
}

const DOWNLOAD_SHARE = 0.8

export function stageRatio(progress: InstallProgress | null): number {
    if (!progress) return 0

    const floor = STAGE_FLOOR[progress.stage] ?? 0
    if (progress.stage !== InstallStage.Download || progress.total <= 0) return floor

    return floor + DOWNLOAD_SHARE * clampRatio(progress.downloaded / progress.total)
}

export function overallRatio(dependencies: Dependency[]): number {
    if (dependencies.length === 0) return 0

    const total = dependencies.reduce(
        (sum, dependency) =>
            sum + (dependency.stage === InstallStage.Done ? 1 : stageRatio(dependency.progress)),
        0,
    )

    return clampRatio(total / dependencies.length)
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`

    const kilobytes = bytes / 1024
    if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`

    return `${(kilobytes / 1024).toFixed(1)} MB`
}

export function stageDetail(dependency: Dependency): string {
    const {progress} = dependency

    if (dependency.stage === InstallStage.Done) return dependency.version
    if (!progress || progress.stage !== InstallStage.Download || progress.total <= 0) return ''

    return `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`
}
