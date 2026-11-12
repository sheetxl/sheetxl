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
      // Vendored third-party source. Not ours to style, and it has to stay diff-clean
      // against upstream so a re-sync is a merge — see packages/sdk/src/numFmt/vendor/README.md.
      // Our own patches there are marked SHEETXL-PATCH.
      '**/src/**/vendor/**',
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
      parserOptions: {
        // Pin the root so typescript-eslint doesn't try to infer it. The VSCode
        // ESLint extension can surface the drive letter in two cases (C:\ vs c:\),
        // which makes inference ambiguous ("multiple candidate TSConfigRootDirs").
        tsconfigRootDir: import.meta.dirname,
      },
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

      // New in eslint 10's recommended set; not adopted (consistent with the relaxed config above).
      'no-useless-assignment': 'off',
      'no-unassigned-vars': 'off',
      'preserve-caught-error': 'off', // worth revisiting later — preserves error cause on rethrow

      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // Strict-ratchet rules, rolled out one package at a time (in step with each package's
  // tsconfig "strict": true). Add package globs to `files` as packages are migrated.
  {
    files: [
      'packages/utils/**/*.{ts,tsx}',
      'packages/primitives/**/*.{ts,tsx}',
      'packages/scripting/**/*.{ts,tsx}',
      'packages/formulas/**/*.{ts,tsx}',
      'packages/formulas-extended/**/*.{ts,tsx}',
      'packages/sdk/**/*.{ts,tsx}',
      'packages/io-xlsx/**/*.{ts,tsx}',
      'packages/io/**/*.{ts,tsx}',
      'packages/runner/**/*.{ts,tsx}',
      'packages/mcp/**/*.{ts,tsx}',
      'packages/cli/**/*.{ts,tsx}',
      'packages/query/**/*.{ts,tsx}',
      'packages/utils-node/**/*.{ts,tsx}',
      'packages/screenshot/**/*.{ts,tsx}',
      'packages/utils-react/**/*.{ts,tsx}',
      'packages/utils-mui/**/*.{ts,tsx}',
      'packages/scripting-react/**/*.{ts,tsx}',
      'packages/scripting-mui/**/*.{ts,tsx}',
      'packages/studio-mui/**/*.{ts,tsx}',
      'packages/studio-vanilla/**/*.{ts,tsx}',
      'packages/grid-react/**/*.{ts,tsx}',
      'packages/react/**/*.{ts,tsx}',
    ],
    rules: {
      // Types/interfaces must be imported with the `type` keyword (inline style matches
      // existing codebase usage: `import { type Foo } from '...'`). Auto-fixable.
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
        // `typeof import('typescript')` lazy-load annotations (scripting) are legitimate.
        disallowTypeAnnotations: false,
      }],
    },
  },

  // Node boundary.
  //
  // tsconfig.base.json sets `"types": []`, so nothing ambient is in scope unless a tsconfig asks for
  // it (`"types": ["node"]` - cli/runner/mcp) or a file declares it (`/// <reference types="node" />`
  // - the `*.node.ts` variants and build-time plugin code). TypeScript can only scope ambient globals
  // per PROGRAM, though: one such declaration puts `process`/`Buffer` in scope for every file that
  // compiles alongside it. This rule is what scopes it per FILE, so browser-bound code cannot quietly
  // reach for a node API that will be `undefined` in a browser or a worker.
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    ignores: [
      // Node programs: node IS the platform.
      'packages/cli/**',
      'packages/runner/**',
      'packages/mcp/**',
      'packages/utils-node/**',
      // Node, except its page (page/, outside src/), which is a browser app.
      'packages/screenshot/**',
      // Node-conditioned modules and build-time code, in any package.
      '**/*.node.ts',
      '**/*.node.tsx',
      '**/plugin/**',
      '**/scripts/**',
      '**/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        // Exact specifiers, not patterns: a bare `group: ['path']` also matches `./path`, because
        // patterns without a slash are matched gitignore-style against every segment.
        paths: [
          'fs', 'fs/promises', 'path', 'os', 'crypto', 'zlib', 'util', 'url', 'stream',
          'stream/promises', 'buffer', 'child_process', 'worker_threads', 'vm', 'readline',
          'module', 'net', 'tty', 'http', 'https', 'perf_hooks', 'inspector', 'timers',
          'timers/promises', 'process',
        ].map(name => ({
          name,
          message:
            'Node built-in in browser-reachable code. Put it in a `*.node.ts` variant behind a `node` ' +
            'export condition, or use the web-standard API (globalThis.crypto, fetch, Blob, atob).',
        })),
        patterns: [{
          group: ['node:*'],
          message:
            'Node built-in in browser-reachable code. Put it in a `*.node.ts` variant behind a `node` ' +
            'export condition, or use the web-standard API (globalThis.crypto, fetch, Blob, atob).',
        }],
      }],
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Node-only global. Use a `*.node.ts` variant, or read it loosely via `globalThis`.' },
        { name: 'Buffer', message: 'Node-only global. Use `Uint8Array`, or `BufferUtils` (which reaches it via `globalThis`).' },
        { name: '__dirname', message: 'Node-only global. Use `import.meta.url` in a `*.node.ts` variant.' },
        { name: '__filename', message: 'Node-only global. Use `import.meta.url` in a `*.node.ts` variant.' },
        { name: 'setImmediate', message: 'Node-only global. Use `TimerUtils`, which falls back to a task queue.' },
      ],
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
