import {pluralize} from '@/shared/lib/format'

export function MissingInputs({count}: {count: number}) {
    if (count === 0) return null

    return (
        <span className="inline-flex items-center rounded-sm bg-state-approval-tint px-2.5 py-1 text-xs font-bold tracking-[0.05em] text-state-approval uppercase">
            {pluralize(count, 'required input')} left
        </span>
    )
}
