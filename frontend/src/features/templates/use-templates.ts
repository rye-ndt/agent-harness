import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import * as api from '@/features/templates/api'

const TEMPLATES_KEY = ['templates']

export function useTemplates() {
    const queryClient = useQueryClient()
    const {data, isPending} = useQuery({queryKey: TEMPLATES_KEY, queryFn: api.listTemplates})

    const invalidate = () => queryClient.invalidateQueries({queryKey: TEMPLATES_KEY})

    const save = useMutation({mutationFn: api.upsertTemplate, onSuccess: invalidate})
    const remove = useMutation({mutationFn: api.removeTemplate, onSuccess: invalidate})

    return {
        templates: data ?? [],
        loading: isPending,
        saveTemplate: save.mutateAsync,
        saving: save.isPending,
        removeTemplate: remove.mutate,
    }
}
