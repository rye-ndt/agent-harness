import {useQuery} from '@tanstack/react-query'

import * as api from '@/features/sessions/api'
import type {ActivityLine} from '@/features/sessions/types'

const ACTIVITY_POLL_MS = 900

const NO_LINES: ActivityLine[] = []

/**
 * What one running node is saying about itself. The feed is already in memory
 * by the time this asks for it — the run poll puts it there — so a query per
 * running node costs nothing and can live in the leaf that renders it.
 */
export function useTaskActivity(taskId: string, enabled: boolean) {
    const {data} = useQuery({
        queryKey: ['task-activity', taskId],
        queryFn: () => api.taskActivity(taskId),
        meta: {action: 'Could not read what this node is doing'},
        refetchInterval: enabled ? ACTIVITY_POLL_MS : false,
        refetchIntervalInBackground: true,
    })

    return data ?? NO_LINES
}
