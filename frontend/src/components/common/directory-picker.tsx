import {useEffect, useState, type KeyboardEvent} from 'react'
import {ChevronRight, CornerLeftUp, Folder, FolderPlus} from 'lucide-react'

import {DialogShell} from '@/components/common/dialog-shell'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {hasNativeDirectoryPicker, registerDirectoryChooser} from '@/api/dialogs'
import {errorMessage} from '@/lib/errors'
import {joinPath, mockChildDirectories, mockCreateDirectory, MOCK_HOME, parentPath} from '@/lib/mock-fs'

type Request = {
    title: string
    resolve: (path: string) => void
}

/**
 * Stands in for the native folder dialog outside the Wails webview, where the
 * OS chooser is unreachable and the browser refuses to disclose absolute paths.
 * Inside the webview ChooseDirectory answers instead and this never mounts.
 */
export function DirectoryPickerHost() {
    const [request, setRequest] = useState<Request | null>(null)

    useEffect(() => {
        if (hasNativeDirectoryPicker()) return

        registerDirectoryChooser(
            (title) => new Promise<string>((resolve) => setRequest({title, resolve})),
        )

        return () => registerDirectoryChooser(null)
    }, [])

    if (!request) return null

    const settle = (path: string) => {
        request.resolve(path)
        setRequest(null)
    }

    return <DirectoryPicker title={request.title} onSettle={settle} />
}

function DirectoryPicker({title, onSettle}: {title: string; onSettle: (path: string) => void}) {
    const [path, setPath] = useState(MOCK_HOME)
    const [newName, setNewName] = useState<string | null>(null)
    const [error, setError] = useState('')

    const children = mockChildDirectories(path)
    const parent = parentPath(path)

    const cancel = (open: boolean) => {
        if (!open) onSettle('')
    }

    const enter = (next: string) => {
        setPath(next)
        setNewName(null)
        setError('')
    }

    const createFolder = () => {
        try {
            enter(mockCreateDirectory(path, newName ?? ''))
        } catch (cause) {
            setError(errorMessage(cause))
        }
    }

    return (
        <DialogShell
            open
            onOpenChange={cancel}
            title={title}
            footer={
                <>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">
                        {path}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => onSettle('')}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={() => onSettle(path)}>
                        Choose folder
                    </Button>
                </>
            }
        >
            <div className="divide-y divide-border">
                {parent !== null && (
                    <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                        onClick={() => enter(parent)}
                    >
                        <CornerLeftUp className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono text-base text-muted-foreground">
                            {parent}
                        </span>
                    </button>
                )}

                {children.map((name) => (
                    <button
                        key={name}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                        onClick={() => enter(joinPath(path, name))}
                    >
                        <Folder className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-base">{name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                ))}

                {children.length === 0 && (
                    <p className="px-4 py-3 text-base text-muted-foreground">
                        No folders inside this one. Choose it, make one, or go back up.
                    </p>
                )}

                {newName === null ? (
                    <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                        onClick={() => setNewName('')}
                    >
                        <FolderPlus className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-base">New folder</span>
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex gap-2">
                            <Input
                                autoFocus
                                value={newName}
                                placeholder="Folder name"
                                aria-label="New folder name"
                                spellCheck={false}
                                className="font-mono"
                                onChange={(event) => setNewName(event.target.value)}
                                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                                    if (event.key === 'Enter') createFolder()
                                    if (event.key === 'Escape') setNewName(null)
                                }}
                            />
                            <Button size="sm" onClick={createFolder}>
                                Create
                            </Button>
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                )}
            </div>
        </DialogShell>
    )
}
