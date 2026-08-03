import {DirectoryField} from '@/components/common/directory-field'

export type SessionLocations = {
    workingDir: string
    contextDir: string
}

export const CONTEXT_SUFFIX = '/.harness/context'

/** The pair of directories a session runs in, picked the same way everywhere. */
export function SessionLocationsFields({
    workingDir,
    contextDir,
    onWorkingDirChange,
    onContextDirChange,
}: {
    workingDir: string
    contextDir: string
    onWorkingDirChange: (path: string) => void
    onContextDirChange: (path: string) => void
}) {
    return (
        <div className="flex flex-col gap-6 p-4">
            <DirectoryField
                label="Working directory"
                hint="The checkout the agents read and change."
                title="Choose the working directory"
                value={workingDir}
                onChange={onWorkingDirChange}
            />

            <DirectoryField
                label="Context directory"
                hint="Where each node writes what the next one needs to know."
                title="Choose the context directory"
                value={contextDir}
                onChange={onContextDirChange}
            />
        </div>
    )
}
