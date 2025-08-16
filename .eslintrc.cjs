/* eslint-env node */
module.exports = {
    root: true,
    env: { browser: true, node: true, es2022: true },
    parser: 'vue-eslint-parser',
    parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
    },
    extends: [
        'eslint:recommended',
        'plugin:vue/vue3-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'prettier', // всегда последним
    ],
    plugins: ['@typescript-eslint', 'vue', 'import', 'simple-import-sort', 'unused-imports'],
    settings: {
        'import/resolver': {
            typescript: {
                project: ['./tsconfig.app.json', './tsconfig.node.json', './tsconfig.json'],
            },
        },
    },
    rules: {
        // стиль импортов
        'simple-import-sort/imports': 'warn',
        'simple-import-sort/exports': 'warn',
        'import/order': 'off',
        'import/no-unresolved': 'off', // пусть решает resolver

        // чистота кода
        'unused-imports/no-unused-imports': 'warn',
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

        // TS
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

        // Vue
        'vue/multi-word-component-names': 'off', // допускаем однословные имена
        'vue/no-mutating-props': 'warn',
        'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'never', component: 'always' } }],
    },
    ignorePatterns: [
        'dist',
        'node_modules',
        '.vite',
        'coverage',
        'public',
        'notes', // нет смысла линтить markdown
    ],
}
