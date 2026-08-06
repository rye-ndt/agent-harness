import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/settings/api/preferences'
import type {TaskLevel, ThinkingLevel} from '@/shared/lib/enums'

const AGENT_DEFAULTS_KEY = ['agent-defaults']
const AGENT_DEFAULT_OPTIONS_KEY = ['agent-default-options']

export type AgentDefaultEdit = {
    taskLevel: TaskLevel
    model: string
    thinkingLevel: ThinkingLevel
}

export function useAgentDefaults() {
    const queryClient = useQueryClient()

    const defaults = useQuery({
        queryKey: AGENT_DEFAULTS_KEY,
        queryFn: api.listAgentDefaults,
        meta: {action: 'Could not load your preferences'},
    })
    const options = useQuery({
        queryKey: AGENT_DEFAULT_OPTIONS_KEY,
        queryFn: api.agentDefaultOptions,
        meta: {action: 'Could not load the models this app can run'},
    })

    const save = useMutation({
        meta: {action: 'Could not save that default'},
        mutationFn: ({taskLevel, model, thinkingLevel}: AgentDefaultEdit) =>
            api.setAgentDefault(taskLevel, model, thinkingLevel),
        onSuccess: () => queryClient.invalidateQueries({queryKey: AGENT_DEFAULTS_KEY}),
    })

    return {
        defaults: defaults.data ?? [],
        options: options.data,
        loading: defaults.isPending || options.isPending,
        pendingTaskLevel: save.isPending ? save.variables.taskLevel : null,
        setAgentDefault: save.mutate,
    }
}
