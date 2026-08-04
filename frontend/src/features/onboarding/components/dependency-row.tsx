import {StateIcon} from '@/shared/components/task-state'
import {Progress} from '@/shared/ui/progress'
import {InstallStage, INSTALL_STAGE_LABELS, TaskState} from '@/shared/lib/enums'
import {stageDetail, stageRatio} from '@/features/onboarding/install'
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
    const installing = state === TaskState.Running
    const percent = Math.round(stageRatio(dependency.progress) * 100)

    return (
        <div className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-center gap-3">
                <StateIcon state={state} />

                <span
                    className={cn(
                        'min-w-0 flex-1 truncate font-mono text-base',
                        state === TaskState.Idle ? 'text-muted-foreground' : 'text-foreground',
                    )}
                >
                    {dependency.name}
                </span>

                {detail && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {detail}
                    </span>
                )}

                <span className="flex w-28 shrink-0 justify-end">
                    {dependency.failed ? (
                        <span className="rounded-sm bg-state-failed-tint px-2.5 py-1 text-xs leading-none font-bold tracking-[0.05em] text-state-failed uppercase">
                            Failed
                        </span>
                    ) : state === TaskState.Done ? (
                        <span className="rounded-sm bg-state-done-tint px-2.5 py-1 text-xs leading-none font-bold tracking-[0.05em] text-state-done uppercase">
                            {INSTALL_STAGE_LABELS[dependency.stage]}
                        </span>
                    ) : (
                        <span className="text-right font-mono text-xs text-muted-foreground">
                            {INSTALL_STAGE_LABELS[dependency.stage]}
                        </span>
                    )}
                </span>
            </div>

            {installing && (
                <Progress
                    aria-label={`Installing ${dependency.name}`}
                    value={percent}
                    className="h-2 rounded-full bg-progress-track"
                    indicatorClassName="bg-progress"
                />
            )}
        </div>
    )
}
