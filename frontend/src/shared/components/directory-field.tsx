import {Folder} from 'lucide-react'

import {chooseDirectory} from '@/shared/api/dialogs'
import {Button} from '@/shared/ui/button'
import {reportError} from '@/shared/lib/error-bus'

export function DirectoryField({
    label,
    hint,
    title,
    value,
    onChange,
}: {
    label: string
    hint: string
    title: string
    value: string
    onChange: (path: string) => void
}) {
    const choose = async () => {
        try {
            const path = await chooseDirectory(title)
            if (path) onChange(path)
        } catch (cause) {
            reportError(cause, 'Could not open the folder picker')
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="text-base font-medium">{label}</span>

            <div className="flex items-center gap-2">
                <span
                    className={
                        value
                            ? 'min-w-0 flex-1 truncate rounded-lg border border-input px-3 py-2 font-mono text-base'
                            : 'min-w-0 flex-1 truncate rounded-lg border border-dashed border-input px-3 py-2 text-base text-muted-foreground'
                    }
                >
                    {value || 'No folder chosen'}
                </span>

                <Button variant="outline" size="sm" className="shrink-0" onClick={choose}>
                    <Folder />
                    {value ? 'Change' : 'Choose'}
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
    )
}
