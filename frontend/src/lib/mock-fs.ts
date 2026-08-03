/** Enough of a tree for the stand-in directory picker to feel like a real one. */

export const MOCK_HOME = '/Users/rye'

const CHILDREN: Record<string, string[]> = {
    '/Users/rye/dev/agent-harness/.harness/context': [],
    '/': ['Users', 'opt', 'tmp'],
    '/Users': ['rye'],
    '/Users/rye': ['dev', 'Documents', 'Downloads'],
    '/Users/rye/dev': ['agent-harness', 'hexago-ui', 'scratch'],
    '/Users/rye/dev/agent-harness': ['.harness', 'frontend', 'internal', 'docs'],
    '/Users/rye/dev/agent-harness/.harness': ['context', 'logs', 'wal'],
    '/Users/rye/dev/agent-harness/frontend': ['src', 'public'],
    '/Users/rye/dev/agent-harness/internal': ['implementation', 'interface', 'helpers'],
    '/Users/rye/dev/hexago-ui': ['src', '.harness'],
    '/Users/rye/dev/hexago-ui/.harness': ['context'],
    '/Users/rye/Documents': ['notes'],
    '/Users/rye/Downloads': ['agent-harness'],
    '/Users/rye/Downloads/agent-harness': ['.harness', 'frontend'],
    '/Users/rye/Downloads/agent-harness/.harness': ['context'],
}

const ILLEGAL_NAME = /[/\\]/

export function mockChildDirectories(path: string): string[] {
    return CHILDREN[path] ?? []
}

/** Mirrors what the OS dialog's New Folder button does, and fails the same ways. */
export function mockCreateDirectory(parent: string, name: string): string {
    const trimmed = name.trim()

    if (!trimmed) throw new Error('Give the folder a name.')
    if (ILLEGAL_NAME.test(trimmed)) throw new Error('A folder name cannot contain a slash.')

    const siblings = CHILDREN[parent] ?? []
    if (siblings.includes(trimmed)) throw new Error(`${trimmed} already exists here.`)

    CHILDREN[parent] = [...siblings, trimmed]
    return joinPath(parent, trimmed)
}

export function joinPath(parent: string, name: string) {
    return parent === '/' ? `/${name}` : `${parent}/${name}`
}

export function parentPath(path: string) {
    if (path === '/') return null

    const cut = path.lastIndexOf('/')
    return cut <= 0 ? '/' : path.slice(0, cut)
}
