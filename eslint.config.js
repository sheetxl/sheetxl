import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Apply to all files
  {
    ignores: [
      '**/build/**',
      'fixtures/**',
      'node_modules/**',
      'docs/api/**',
      'examples/**/dist/**',
      'tutorial/dist/**',
      '**/.generated/**',
      // Package-specific build outputs
      'packages/*/build/**',
      'packages/*/dist/**',
      // Other common patterns
      '**/*.d.ts',
      '**/coverage/**',
    ],
  },

  // Base JavaScript configuration
  js.configs.recommended,

  // TypeScript configuration
  ...tseslint.configs.recommended,
  // Custom overrides
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // was: ['error', { argsIgnorePattern: '^_' }]
      '@typescript-eslint/no-explicit-any': 'off', // was: 'warn'
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/ban-types': 'off',

      'prefer-const': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',

      'no-console': 'off', // Allow console in development
      'no-debugger': 'off', // was: 'error'
      'no-alert': 'off', // was: 'error'
      'no-prototype-builtins': 'off',
      'no-undef': 'off',
      'no-async-promise-executor': 'off',
      'no-empty': 'off',
      'no-var': 'off',
      'no-misleading-character-class': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-extra-boolean-cast': 'off',
      'no-sparse-arrays': 'off',
      'no-loss-of-precision': 'off',
      'no-useless-catch': 'off',
      'no-constant-condition': 'off',
      'no-constant-binary-expression': 'off',
      'no-setter-return': 'off',
      'no-cond-assign': 'off',

      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // Special configuration for test files
  {
    files: ['**/*.test.{js,ts,tsx}', '**/*.spec.{js,ts,tsx}', '**/test/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Configuration files
  {
    files: ['*.config.{js,mjs,cjs,ts}', '.*rc.{js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
