/** The failed node's own account of why it stopped, spoken above the node it belongs to. */
export function FailureBubble({tldr}: {tldr: string}) {
    return (
        <div
            title={tldr}
            className="absolute inset-x-0 bottom-full mb-2 flex animate-in gap-2 rounded-lg bg-state-failed-tint p-2.5 ring-1 ring-state-failed/25 duration-200 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
            <span
                aria-hidden="true"
                className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-state-failed text-[0.625rem] leading-none font-bold text-white"
            >
                !
            </span>
            <p className="line-clamp-4 text-sm leading-snug">
                <span className="sr-only">Why this node stopped: </span>
                {tldr}
            </p>
            <span
                aria-hidden="true"
                className="absolute -bottom-[5px] left-[13px] -z-10 size-2.5 rotate-45 rounded-[2px] bg-state-failed-tint ring-1 ring-state-failed/25"
            />
        </div>
    )
}
