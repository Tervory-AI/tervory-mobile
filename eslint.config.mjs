import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['android/**', 'ios/**', 'www/native.js', '.tmp/**', 'node_modules/**'] },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
