import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {completeOnboarding, isOnboardingRequired} from '@/api/onboarding'

const ONBOARDING_KEY = ['onboarding']

export function useOnboarding() {
    const queryClient = useQueryClient()

    const {data, isPending} = useQuery({
        queryKey: ONBOARDING_KEY,
        queryFn: isOnboardingRequired,
    })

    const {mutate} = useMutation({
        mutationFn: completeOnboarding,
        onMutate: () => {
            queryClient.setQueryData(ONBOARDING_KEY, false)
        },
    })

    return {
        ready: !isPending,
        required: data === true,
        complete: () => mutate(),
    }
}
