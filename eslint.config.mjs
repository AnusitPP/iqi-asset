import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      '@eslint/js': js,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
    },
  },
];
