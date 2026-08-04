import type {Template} from '@/features/templates/types'

export const MOCK_TEMPLATES: Template[] = [
    {
        id: '0192f3a1-0001-7000-8000-000000000001',
        name: 'Code reviewer',
        role: 'Reads a diff and reports the defects it can prove.',
        taskLevel: 'heavy_task',
        retryable: true,
        params: [],
        systemPrompts: [
            {
                key: 'base',
                value: 'You review code. Report only defects you can point to a line for, ranked by severity. Say nothing about style.',
            },
        ],
    },
    {
        id: '0192f3a1-0002-7000-8000-000000000002',
        name: 'Test writer',
        role: 'Writes the tests a change is missing and runs them.',
        taskLevel: 'daily_task',
        retryable: true,
        params: [
            {
                key: 'package_path',
                label: 'Package to cover',
                type: 'text',
                required: true,
            },
            {
                key: 'max_cases',
                label: 'Cases to write at most',
                type: 'number',
                required: false,
                default: '8',
            },
            {
                key: 'focus',
                label: 'What the tests should prove',
                type: 'textarea',
                required: false,
            },
        ],
        systemPrompts: [
            {
                key: 'base',
                value: 'You write tests. Cover the branches a reader would doubt, run them, and report failures verbatim.',
            },
        ],
    },
    {
        id: '0192f3a1-0003-7000-8000-000000000003',
        name: 'Doc pass',
        role: 'Brings the docs back in line with the code.',
        taskLevel: 'lightweight_task',
        retryable: false,
        params: [
            {
                key: 'doc_path',
                label: 'File to update',
                type: 'text',
                required: true,
                default: 'README.md',
            },
        ],
        systemPrompts: [
            {
                key: 'base',
                value: 'You keep documentation honest. Fix what the code contradicts and leave the voice alone.',
            },
        ],
    },
]
