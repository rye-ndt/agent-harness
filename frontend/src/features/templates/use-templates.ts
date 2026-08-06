import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/templates/api'

const TEMPLATES_KEY = ['templates']

export function useTemplates() {
    const queryClient = useQueryClient()
    const {data, isPending} = useQuery({
        queryKey: TEMPLATES_KEY,
        queryFn: api.listTemplates,
        meta: {action: 'Could not load your templates'},
    })

    const invalidate = () => queryClient.invalidateQueries({queryKey: TEMPLATES_KEY})

    const save = useMutation({
        meta: {action: 'Could not save the template'},
        mutationFn: api.upsertTemplate,
        onSuccess: invalidate,
    })
    const remove = useMutation({
        meta: {action: 'Could not delete the template'},
        mutationFn: api.removeTemplate,
        onSuccess: invalidate,
    })

    return {
        templates: data ?? [],
        loading: isPending,
        saveTemplate: save.mutate,
        saving: save.isPending,
        removeTemplate: remove.mutate,
    }
}
