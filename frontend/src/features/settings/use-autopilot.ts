import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/settings/api/preferences'

const AUTOPILOT_KEY = ['autopilot']

export function useAutopilot() {
    const queryClient = useQueryClient()

    const autopilot = useQuery({
        queryKey: AUTOPILOT_KEY,
        queryFn: api.autopilot,
        meta: {action: 'Could not load the autopilot setting'},
    })

    const save = useMutation({
        meta: {action: 'Could not change autopilot'},
        mutationFn: (on: boolean) => api.setAutopilot(on),
        onSuccess: () => queryClient.invalidateQueries({queryKey: AUTOPILOT_KEY}),
    })

    return {
        autopilot: autopilot.data ?? false,
        loading: autopilot.isPending,
        saving: save.isPending,
        setAutopilot: save.mutate,
    }
}
