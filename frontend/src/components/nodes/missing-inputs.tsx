import {pluralize} from '@/lib/format'

export function MissingInputs({count}: {count: number}) {
    if (count === 0) return null

    return (
        <span className="text-sm text-muted-foreground">
            {pluralize(count, 'required input')} left
        </span>
    )
}
