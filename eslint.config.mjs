import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['build/**', 'node_modules/**'] },
  js.configs.recommended,

  // Frontend (browser, ES modules, JSX)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // core no-unused-vars doesn't understand JSX usage; ignore PascalCase (components)
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }]
    }
  },
  reactHooks.configs.flat['recommended-latest'],

  // Server and scripts (Node, CommonJS)
  {
    files: ['server/**/*.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node }
  },

  // Tests (ES modules run by Vitest), including server tests
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, ...globals.node, ...globals.vitest } }
  }
];
