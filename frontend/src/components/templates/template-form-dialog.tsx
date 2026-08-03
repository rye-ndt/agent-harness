import {useState} from 'react'

import {DialogShell} from '@/components/common/dialog-shell'
import {TemplateForm} from '@/components/templates/template-form'
import {Button} from '@/components/ui/button'
import {useTemplates} from '@/hooks/use-templates'
import {errorMessage} from '@/lib/errors'
import {emptyTemplate, templateIssues} from '@/lib/template'
import {cn} from '@/lib/utils'
import type {Template, TemplateDraft} from '@/types/template'

export function TemplateFormDialog({
    template,
    onClose,
}: {
    template: Template | null
    onClose: () => void
}) {
    const {saveTemplate, saving} = useTemplates()
    const [draft, setDraft] = useState<TemplateDraft>(() =>
        template ? structuredClone(template) : emptyTemplate(),
    )
    const [error, setError] = useState('')

    const issues = templateIssues(draft)

    const close = (open: boolean) => {
        if (!open) onClose()
    }

    const save = async () => {
        if (issues.length > 0) return

        try {
            await saveTemplate(draft)
            onClose()
        } catch (error: unknown) {
            setError(errorMessage(error))
        }
    }

    const saveLabel = template ? 'Save changes' : 'Create template'

    return (
        <DialogShell
            open
            onOpenChange={close}
            title={template ? 'Edit template' : 'New template'}
            footer={
                <>
                    <p
                        className={cn(
                            'min-w-0 flex-1 text-sm',
                            error ? 'text-destructive' : 'text-muted-foreground',
                        )}
                    >
                        {error || issues[0] || ''}
                    </p>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={saving || issues.length > 0} onClick={save}>
                        {saving ? 'Saving' : saveLabel}
                    </Button>
                </>
            }
        >
            <TemplateForm draft={draft} onChange={setDraft} />
        </DialogShell>
    )
}
