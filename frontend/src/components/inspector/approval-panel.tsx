import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {cn} from '@/lib/utils'
import type {Approval} from '@/types/session'

export function ApprovalPanel({
    approval,
    onAnswer,
}: {
    approval: Approval
    onAnswer: (approved: boolean, optionIds: string[], guidance: string) => void
}) {
    const [picked, setPicked] = useState<string[]>([])
    const [guidance, setGuidance] = useState('')

    const toggle = (optionId: string) => {
        setPicked((prev) => {
            if (!approval.multiSelect) return [optionId]
            return prev.includes(optionId)
                ? prev.filter((id) => id !== optionId)
                : [...prev, optionId]
        })
    }

    return (
        <div className="flex flex-col gap-2.5 rounded-md bg-state-approval-tint p-3 ring-1 ring-state-approval/20">
            <div className="flex flex-col gap-1">
                <p className="text-[0.8125rem] font-medium">{approval.question}</p>
                {approval.detail && (
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                        {approval.detail}
                    </p>
                )}
                {approval.multiSelect && approval.options.length > 1 && (
                    <p className="text-xs text-muted-foreground">Pick one or more.</p>
                )}
            </div>

            <div className="flex flex-col gap-1">
                {approval.options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={picked.includes(option.id)}
                        onClick={() => toggle(option.id)}
                        className={cn(
                            'rounded-md border border-border px-2 py-1.5 text-left transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                            picked.includes(option.id)
                                ? 'bg-background ring-1 ring-live'
                                : 'hover:bg-background/60',
                        )}
                    >
                        <span className="block text-xs font-medium">{option.label}</span>
                        {option.description && (
                            <span className="block text-[0.6875rem] text-muted-foreground">
                                {option.description}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <Input
                value={guidance}
                placeholder="Add guidance (optional)"
                className="bg-background text-[0.8125rem]"
                onChange={(event) => setGuidance(event.target.value)}
            />

            <div className="flex gap-2">
                <Button
                    size="sm"
                    className="flex-1"
                    disabled={picked.length === 0}
                    onClick={() => onAnswer(true, picked, guidance.trim())}
                >
                    Approve
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onAnswer(false, [], guidance.trim())}
                >
                    Reject
                </Button>
            </div>
        </div>
    )
}
