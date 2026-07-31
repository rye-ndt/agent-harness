import {useState} from 'react'
import {Plug} from 'lucide-react'

import {MCPPanel} from '@/components/settings/mcp-panel'
import {SettingsNav, type SettingsTab} from '@/components/settings/settings-nav'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog'

const TABS: SettingsTab[] = [{id: 'mcp', label: 'MCP', icon: Plug}]

export function SettingsDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [activeId, setActiveId] = useState(TABS[0].id)
    const active = TABS.find((tab) => tab.id === activeId) ?? TABS[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[520px] max-w-[760px] gap-0 overflow-hidden p-0">
                <DialogDescription className="sr-only">
                    Settings shared by every session.
                </DialogDescription>

                <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-sidebar">
                    <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
                        <span className="micro-label">Settings</span>
                    </div>
                    <SettingsNav tabs={TABS} activeId={activeId} onSelect={setActiveId} />
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
                        <DialogTitle className="text-[0.8125rem]">{active.label}</DialogTitle>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {active.id === 'mcp' && <MCPPanel />}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
