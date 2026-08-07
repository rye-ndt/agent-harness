import {SessionStatus} from '@/shared/lib/enums'

export const SESSION_BADGE_CLASSES: Record<SessionStatus, string> = {
    [SessionStatus.Empty]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Draft]: 'bg-state-idle-tint text-muted-foreground',
    [SessionStatus.Ready]: 'bg-info-tint text-info',
    [SessionStatus.Running]: 'bg-state-running-tint text-state-running',
    [SessionStatus.Done]: 'bg-state-done-tint text-state-done',
    [SessionStatus.Failed]: 'bg-state-failed-tint text-state-failed',
    [SessionStatus.Cancelled]: 'bg-state-idle text-white',
}

export const SESSION_TITLE_CLASSES: Record<SessionStatus, string> = {
    [SessionStatus.Empty]: 'text-muted-foreground',
    [SessionStatus.Draft]: 'text-state-approval',
    [SessionStatus.Ready]: 'text-state-approval',
    [SessionStatus.Running]: 'text-info',
    [SessionStatus.Done]: 'text-state-done',
    [SessionStatus.Failed]: 'text-state-failed',
    [SessionStatus.Cancelled]: 'text-muted-foreground',
}
