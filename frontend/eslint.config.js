import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {ignores: ['dist', 'wailsjs']},
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            prettier,
        ],
        languageOptions: {
            globals: globals.browser,
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/mock-*'],
                            message: 'Mocks back the api seam. Import the api module instead.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/**/api.ts', 'src/**/api/*.ts', 'src/**/mock-*.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
    {
        files: ['src/shared/ui/**'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
)
