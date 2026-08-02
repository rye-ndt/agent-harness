import type {LucideIcon} from 'lucide-react'

import {cn} from '@/lib/utils'

export type SettingsTab = {
    id: string
    label: string
    icon: LucideIcon
}

export function SettingsNav({
    tabs,
    activeId,
    onSelect,
}: {
    tabs: readonly SettingsTab[]
    activeId: string
    onSelect: (id: string) => void
}) {
    return (
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
            {tabs.map(({id, label, icon: Icon}) => {
                const active = id === activeId

                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50',
                            active
                                ? 'bg-sidebar-accent font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4 shrink-0" />
                        {label}
                    </button>
                )
            })}
        </nav>
    )
}
