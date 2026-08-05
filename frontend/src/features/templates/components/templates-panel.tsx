import {useState} from 'react'
import {Plus} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {TemplateFormDialog} from '@/features/templates/components/template-form-dialog'
import {TemplateList} from '@/features/templates/components/template-list'
import {useTemplates} from '@/features/templates/use-templates'
import type {Template} from '@/features/templates/types'

type TemplateEdit = {template: Template | null}

export function TemplatesPanel({onPick}: {onPick?: (template: Template) => void}) {
    const {templates, loading, removeTemplate} = useTemplates()
    const [editing, setEditing] = useState<TemplateEdit | null>(null)

    const newTemplate = () => setEditing({template: null})
    const editTemplate = (template: Template) => setEditing({template})
    const closeForm = () => setEditing(null)

    return (
        <section className="flex flex-col">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="text-lg font-medium">
                        {onPick ? 'Pick a template' : 'Templates your nodes start from'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        One kind of work: the agent's role, its inputs, and how hard to try.
                    </p>
                </div>

                {templates.length > 0 && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={newTemplate}>
                        <Plus />
                        New template
                    </Button>
                )}
            </div>

            <div className="border-t border-border">
                <TemplateList
                    templates={templates}
                    loading={loading}
                    onPick={onPick ?? editTemplate}
                    onEdit={editTemplate}
                    onRemove={removeTemplate}
                    onCreate={newTemplate}
                />
            </div>

            {editing && <TemplateFormDialog template={editing.template} onClose={closeForm} />}
        </section>
    )
}
