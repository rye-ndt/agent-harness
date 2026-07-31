import {cn} from '@/lib/utils'

export function StepSpine({total, current}: {total: number; current: number}) {
    return (
        <div className="flex items-center justify-center" aria-hidden>
            {Array.from({length: total}, (_, index) => (
                <div key={index} className="flex items-center">
                    {index > 0 && (
                        <span
                            className={cn(
                                'h-px w-7 transition-colors duration-150',
                                index <= current ? 'bg-live' : 'bg-border',
                            )}
                        />
                    )}
                    <span
                        className={cn(
                            'size-1.5 rounded-full transition-all duration-150',
                            index <= current ? 'bg-live' : 'bg-border',
                            index === current && 'ring-4 ring-live-tint',
                        )}
                    />
                </div>
            ))}
        </div>
    )
}
