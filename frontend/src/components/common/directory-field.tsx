import {useState} from 'react'
import {Folder} from 'lucide-react'

import {chooseDirectory} from '@/api/dialogs'
import {Button} from '@/components/ui/button'
import {errorMessage} from '@/lib/errors'

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
    const [error, setError] = useState('')

    const choose = async () => {
        setError('')

        try {
            const path = await chooseDirectory(title)
            if (path) onChange(path)
        } catch (cause) {
            setError(errorMessage(cause))
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

            {error ? (
                <p className="text-sm text-destructive">{error}</p>
            ) : (
                <p className="text-sm text-muted-foreground">{hint}</p>
            )}
        </div>
    )
}
