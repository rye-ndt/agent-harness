import {useState} from 'react'

import {AgentChoice} from '@/components/onboarding/agent-choice'
import {StepSpine} from '@/components/common/step-spine'
import {Button} from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

type Step = 'welcome' | 'agent' | 'done'

const ORDER: Step[] = ['welcome', 'agent', 'done']

const COPY: Record<Step, {label: string; title: string; description: string}> = {
    welcome: {
        label: 'Welcome',
        title: 'Route work across a fleet of agents.',
        description:
            'A session is a graph of scoped tasks. Each one runs on a coding agent, and what a task learns is handed to the tasks downstream of it.',
    },
    agent: {
        label: 'Choose an agent',
        title: 'Which agent runs your tasks?',
        description: 'Install one to continue. You can add the other later in Settings.',
    },
    done: {
        label: "You're set",
        title: 'Happy routing.',
        description:
            'Create a session, drop in a few tasks, and connect them into a chain. The graph runs a task once everything upstream of it is done.',
    },
}

export function OnboardingFlow({onDone}: {onDone: () => void}) {
    const [step, setStep] = useState<Step>('welcome')
    const copy = COPY[step]

    return (
        <Dialog open>
            <DialogContent
                showCloseButton={false}
                className="flex min-h-[360px] flex-col gap-6 p-8"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onPointerDownOutside={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <StepSpine total={ORDER.length} current={ORDER.indexOf(step)} />

                <DialogHeader className="items-center gap-2 text-center">
                    <span className="micro-label">{copy.label}</span>
                    <DialogTitle className="text-xl">{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>

                <div className="flex-1">
                    {step === 'agent' && <AgentChoice onInstalled={() => setStep('done')} />}
                </div>

                {step !== 'agent' && (
                    <DialogFooter className="justify-center">
                        {step === 'welcome' ? (
                            <Button className="min-w-36" onClick={() => setStep('agent')}>
                                Next
                            </Button>
                        ) : (
                            <Button className="min-w-36" onClick={onDone}>
                                Done
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
