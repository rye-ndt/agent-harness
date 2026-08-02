import {useEffect, useState} from 'react'

import {DialogShell} from '@/components/common/dialog-shell'
import {TemplateForm} from '@/components/templates/template-form'
import {Button} from '@/components/ui/button'
import {useTemplates} from '@/hooks/use-templates'
import {emptyTemplate, templateIssues} from '@/lib/template'
import type {Template, TemplateDraft} from '@/types/template'

export function TemplateFormDialog({
    open,
    template,
    onOpenChange,
}: {
    open: boolean
    template: Template | null
    onOpenChange: (open: boolean) => void
}) {
    const {saveTemplate, saving} = useTemplates()
    const [draft, setDraft] = useState<TemplateDraft>(emptyTemplate)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!open) return
        setDraft(template ? structuredClone(template) : emptyTemplate())
        setError('')
    }, [open, template])

    const issues = templateIssues(draft)

    const save = async () => {
        if (issues.length > 0) {
            setError(issues[0])
            return
        }

        try {
            await saveTemplate(draft)
            onOpenChange(false)
        } catch (err) {
            setError(String(err))
        }
    }

    return (
        <DialogShell
            open={open}
            onOpenChange={onOpenChange}
            title={template ? 'Edit template' : 'New template'}
            footer={
                <>
                    <p className="min-w-0 flex-1 truncate text-sm text-destructive">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={saving} onClick={save}>
                        {saving ? 'Saving' : template ? 'Save changes' : 'Create template'}
                    </Button>
                </>
            }
        >
            <TemplateForm draft={draft} onChange={setDraft} />
        </DialogShell>
    )
}
