/**
 * The directory-chooser seam. Inside the Wails webview this is the real native
 * folder dialog — ChooseDirectory wraps runtime.OpenDirectoryDialog with
 * CanCreateDirectories, so creating a folder comes from the OS, and it returns
 * an absolute path or "" when the user cancels. Under the plain vite dev server
 * there is no runtime and the File System Access API refuses to disclose
 * absolute paths, so a stand-in picker answers the same contract instead.
 */

import {hasWailsRuntime} from '@/shared/api/bridge'
import {mockChildDirectories, mockCreateDirectory, MOCK_HOME} from '@/shared/api/mock-fs'
import {ChooseDirectory} from '@wailsjs/go/wails_api/API'

export type DirectoryChooser = (title: string) => Promise<string>

let standIn: DirectoryChooser | null = null

export function registerDirectoryChooser(next: DirectoryChooser | null) {
    standIn = next
}

/** True when the OS dialog answers this, so the stand-in never needs to mount. */
export function hasNativeDirectoryPicker() {
    return hasWailsRuntime()
}

/** Resolves to the chosen absolute path, or an empty string if the user cancels. */
export async function chooseDirectory(title: string): Promise<string> {
    if (hasNativeDirectoryPicker()) return ChooseDirectory(title)
    if (!standIn) throw new Error('No directory picker is available right now.')

    return standIn(title)
}

export async function listDirectories(path: string): Promise<string[]> {
    return mockChildDirectories(path)
}

export async function createDirectory(parent: string, name: string): Promise<string> {
    return mockCreateDirectory(parent, name)
}

export async function homeDirectory(): Promise<string> {
    return MOCK_HOME
}
