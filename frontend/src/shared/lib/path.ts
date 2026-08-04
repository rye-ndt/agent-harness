export function joinPath(parent: string, name: string) {
    return parent === '/' ? `/${name}` : `${parent}/${name}`
}

export function parentPath(path: string) {
    if (path === '/') return null

    const cut = path.lastIndexOf('/')
    return cut <= 0 ? '/' : path.slice(0, cut)
}
