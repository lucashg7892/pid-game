import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly' },
    },
  },
  {
    // Déterminisme du noyau (spec T-001 §3.3, §4) : ni aléa ni horloge murale.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'sim/ doit être déterministe : utiliser un PRNG à graine explicite.',
        },
        {
          object: 'Date',
          property: 'now',
          message: "sim/ ne lit jamais l'horloge : le temps est fourni par l'appelant.",
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message: "sim/ ne lit jamais l'horloge : le temps est fourni par l'appelant.",
        },
        {
          name: 'performance',
          message: "sim/ ne lit jamais l'horloge : le temps est fourni par l'appelant.",
        },
      ],
    },
  },
);
