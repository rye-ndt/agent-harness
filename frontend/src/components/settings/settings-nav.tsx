import type {LucideIcon} from 'lucide-react'

import {cn} from '@/lib/utils'

export type SettingsTab<TId extends string = string> = {
    id: TId
    label: string
    icon: LucideIcon
}

export function SettingsNav<TId extends string>({
    tabs,
    activeId,
    onSelect,
}: {
    tabs: readonly SettingsTab<TId>[]
    activeId: TId
    onSelect: (id: TId) => void
}) {
    return (
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
            {tabs.map((tab) => (
                <SettingsNavItem
                    key={tab.id}
                    tab={tab}
                    active={tab.id === activeId}
                    onSelect={onSelect}
                />
            ))}
        </nav>
    )
}

function SettingsNavItem<TId extends string>({
    tab,
    active,
    onSelect,
}: {
    tab: SettingsTab<TId>
    active: boolean
    onSelect: (id: TId) => void
}) {
    const Icon = tab.icon
    const select = () => onSelect(tab.id)

    return (
        <button
            type="button"
            onClick={select}
            className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50',
                active
                    ? 'bg-sidebar-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
            )}
        >
            <Icon className="size-4 shrink-0" />
            {tab.label}
        </button>
    )
}
