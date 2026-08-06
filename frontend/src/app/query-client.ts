import {MutationCache, QueryCache, QueryClient} from '@tanstack/react-query'

import {reportError} from '@/shared/lib/error-bus'

declare module '@tanstack/react-query' {
    interface Register {
        queryMeta: {action: string}
        mutationMeta: {action: string}
    }
}

function actionOf(action: string | undefined, variables: unknown) {
    if (action) return action

    if (variables && typeof variables === 'object' && 'action' in variables)
        return String(variables.action)

    return ''
}

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => reportError(error, query.meta?.action),
    }),
    mutationCache: new MutationCache({
        onError: (error, variables, _context, mutation) =>
            reportError(error, actionOf(mutation.meta?.action, variables)),
    }),
    defaultOptions: {
        queries: {
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            retry: false,
        },
        mutations: {
            retry: false,
        },
    },
})
