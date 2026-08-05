/**
 * A prompt can embed an input by key: `{{ticket_id}}`. This module is the only
 * place that knows the syntax — it finds the references, splits a prompt for
 * highlighting, and substitutes the values a node supplied.
 */

import type {FieldValue, ParamValue} from '@/features/templates/types'

const REFERENCE = /\{\{\s*([\w.-]+)\s*\}\}/g

export const PARAM_REF_HINT = 'Wrap an input key in {{ }} to drop its value into the text.'

export type PromptSegment = {
    text: string
    key: string | null
}

export function paramRefs(text: string): string[] {
    const keys = new Set<string>()
    for (const match of text.matchAll(REFERENCE)) keys.add(match[1])
    return [...keys]
}

/** Splits a prompt into plain runs and reference runs so both can be styled. */
export function promptSegments(text: string): PromptSegment[] {
    const segments: PromptSegment[] = []
    let cursor = 0

    for (const match of text.matchAll(REFERENCE)) {
        const start = match.index
        if (start > cursor) segments.push({text: text.slice(cursor, start), key: null})

        segments.push({text: match[0], key: match[1]})
        cursor = start + match[0].length
    }

    if (cursor < text.length) segments.push({text: text.slice(cursor), key: null})
    return segments
}

export function fillPrompt(text: string, values: Record<string, ParamValue | FieldValue>): string {
    return text.replace(REFERENCE, (reference, key: string) => {
        const value = values[key]
        return value === undefined || String(value) === '' ? reference : String(value)
    })
}
