import {StateIcon} from '@/shared/components/task-state'
import {InstallStage, INSTALL_STAGE_LABELS, TaskState} from '@/shared/lib/enums'
import {stageDetail} from '@/features/onboarding/install'
import {cn} from '@/shared/lib/utils'
import type {Dependency} from '@/features/agents/types'

const ROW_STATES: Record<InstallStage, TaskState> = {
    [InstallStage.Queued]: TaskState.Idle,
    [InstallStage.Resolve]: TaskState.Running,
    [InstallStage.Download]: TaskState.Running,
    [InstallStage.Extract]: TaskState.Running,
    [InstallStage.Done]: TaskState.Done,
}

export function DependencyRow({dependency}: {dependency: Dependency}) {
    const state = dependency.failed ? TaskState.Failed : ROW_STATES[dependency.stage]
    const detail = stageDetail(dependency)

    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <StateIcon state={state} />

            <span
                className={cn(
                    'min-w-0 flex-1 truncate text-base',
                    state === TaskState.Idle ? 'text-muted-foreground' : 'text-foreground',
                )}
            >
                {dependency.name}
            </span>

            {detail && (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{detail}</span>
            )}

            <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {dependency.failed ? 'Failed' : INSTALL_STAGE_LABELS[dependency.stage]}
            </span>
        </div>
    )
}
