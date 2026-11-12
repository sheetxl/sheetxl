import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { LocaleBundlePlugin } from './vite-plugin-locale-bundle';

/**
 * Shared vitest configuration — the single source for BOTH the repo root and per-package
 * `vitest.config.ts` files.
 *
 * ## Why per-package configs exist
 *
 * Without one, `vitest` run from a package directory (or an IDE vitest extension rooted there)
 * falls back to that package's `vite.config.ts` — the LIBRARY BUILD config. Tests then run with
 * no setup files, no environment split, and a build-oriented plugin set; the first casualty is
 * the `virtual:sheetxl/bundled-locale` import, which dies in the module runner with
 * `file:///%00virtual:...` "must be a file URL". Each package instead re-exports this config,
 * so a package-local run gets the exact root setup, scoped to that package's tests (the
 * `include` globs are relative to whichever directory vitest treats as root).
 *
 * Setup-file paths are ABSOLUTE (anchored to this file's directory) for exactly that reason —
 * a consuming config can live anywhere in the repo.
 */

const _configDir = path.dirname(fileURLToPath(import.meta.url));

// Disable timeout when debugging. Otherwise 90s (not a tight 10s, and no longer 30s): the heaviest
// suites are io/calc round-trips (xlsx write→read with freeze+scroll+zoom, calc graphs) and
// deliberately-expensive crypto (password hashing runs 100000 SHA-512 iterations by design). These
// legitimately take seconds, and under parallel load — or on a slower/variable CI runner — 30s
// still flaked often enough to be noise rather than signal. A hung test is hung; it will trip 90s
// just as surely, only later.
const testTimeout = process.env.NODE_ENV === 'debug' ? 0 : 90000;

/**
 * Fixture-driven formula conformance tests — `packages/sdk/src/__tests__/functions/*.formula.test.ts`.
 *
 * Fourteen files glob ~18MB of JSON fixtures into ~32000 generated cases (statistical alone is
 * ~18000), which is the great majority of the repo's test cases and the great majority of a run's
 * wall clock. They exercise per-function VALUE semantics only, so nothing in the sheet/model/UI
 * layers can regress them — which makes them dead weight on the edit-test loop that sdk and UI work
 * actually runs.
 *
 * So they are OFF by default and the suffix is what routes them, the same way `*.node.test.ts` and
 * `*.jsdom.test.ts` route by environment. A new fixture-driven file gets this treatment by being
 * named for it; the hand-written tests that live in the same directories (`dateEdges.node.test.ts`,
 * `ascDbcs.locale.test.ts`) are not fixture-driven and stay in the default run.
 *
 * Note this is the CONFORMANCE table only. The calc ENGINE tests (`__tests__/calculation` — compiler,
 * graph, spill, named, cross-sheet) are hand-written, cheap, and DO break from sheet/range edits, so
 * they stay in the default run.
 *
 * Selected by `SHEETXL_TEST_FORMULAS`, which the root `test:*` scripts set:
 *   unset    `pnpm test`          — excluded (default)
 *   `all`    `pnpm test:all`      — included alongside everything else
 *   `only`   `pnpm test:formulas` — the only thing that runs
 *
 * An env var rather than a config option because it has to reach BOTH a root-rooted run and a
 * package-rooted one (CLI or IDE extension) through the same `createVitestConfig` call. An IDE run,
 * having no var set, gets the fast default.
 *
 * One non-formula sweep reads the same var: the engine-on corpus pass in io-xlsx
 * `write.preservedRels.node.test.ts`, which runs only under `pnpm test:all`.
 */
const formulaTests = '**/__tests__/functions/**/*.formula.test.{js,ts}';

const formulaMode = process.env.SHEETXL_TEST_FORMULAS;
const formulaExclude = formulaMode ? [] : [formulaTests];
const formulaOnly = formulaMode === 'only';

const sharedExclude = [
  '**/node_modules/**',
  '**/build/**'
];

// Vitest's `projects` each get their OWN worker pool, so this cap is PER PROJECT — Node.js and
// Browser together run 2x this many forks. Unset, each auto-detects ~CPU-count forks.
//
// This is a commit budget, not a CPU one. Forks over the heavier calc/io suites hold BUFFERS and
// typed arrays that V8's heap cap does not bound, and an exhausted commit limit is not a clean OOM —
// the fork dies of a native `AlignedAlloc` failure and takes whatever else is near the limit (the
// IDE) with it.
//
// `--maxWorkers` does NOT override this, though it reads as though it should: a project-level value
// wins over the root CLI option, so the flag is silently ignored — `--maxWorkers=6`
// still forks 2. `SHEETXL_TEST_WORKERS` is the knob that actually works.
//
// The count scales nearly linearly, so it was worth re-measuring rather than inheriting. Root suite,
// 698 files, same results at every setting:
//
//   2 per project (4 forks)   372s   2.70GB peak commit
//   4 per project (8 forks)   230s   3.47GB
//   6 per project (12 forks)  163s   4.85GB
//
// 6 is the default because the constraint that forced 2 is gone. That number was set on 2026-09-01
// against a box with ~5GB of commit headroom, most of which turned out to be 32 abandoned agent
// sessions holding 15GB; with those reclaimed there is room for the fast setting. It is still a
// budget rather than a maximum — `vitest.globalSetup.ts` is what stops three worktrees from each
// taking 4.85GB at once, and it sizes its estimate against THIS number.
const maxWorkers = Number(process.env.SHEETXL_TEST_WORKERS) || 6;

/**
 * Per-fork V8 heap cap. Node 24 defaults each fork to a ~4.5GB heap on this class of machine, and
 * V8 feels no collection pressure until it gets there, which is how per-fork peaks drifted to
 * 2.6-2.9GB against a budget sized for 0.6-1.6GB. Capping the heap forces earlier GC; the cap is
 * well above what any suite needs on its own, and Buffer/typed-array backing stores are external to
 * it and unaffected. Combined with `maxWorkers` this bounds the run at roughly 4 x (2GB + buffers).
 */
const execArgv = ['--max-old-space-size=2048'];

/**
 * Packages whose UNIVERSAL (`*.test.{js,ts}`) tests run in the Node.js project ONLY.
 *
 * These are not node-only packages — they still get a Browser project, and an explicitly-named
 * `*.jsdom.test.ts` in them still runs there. What is dropped is the DEFAULT of running every
 * environment-agnostic test twice.
 *
 * `@sheetxl/sdk` is the whole model/calc engine and holds the bulk of the repo's tests. It touches
 * no DOM, and no test in it has ever failed under jsdom without also failing under Node — so the
 * second run bought nothing while doubling both the wall clock and the failure COUNT, which is the
 * worse cost: every real regression was reported twice, and a triage list of N failures was really
 * N/2 problems. A package that grows genuine DOM behavior should either drop off this list or name
 * those tests `*.jsdom.test.ts`.
 *
 * Paths are relative to the REPO ROOT, so this list only bites a root-level run; a package-rooted
 * run passes `nodeOnlyUniversal` instead (see `packages/sdk/vitest.config.ts`).
 */
const nodeOnlyUniversalPackages = [
  'packages/sdk',
];

/**
 * Excludes a package's universal tests from the Browser project while keeping its `*.jsdom` ones.
 */
const excludeUniversal = (prefix: string): string => `${prefix}!(*.jsdom).test.{js,ts}`;

export interface CreateVitestConfigOptions {
  /**
   * Exclude the jsdom ("Browser") project entirely.
   *
   * @defaultValue `false`
   *
   * @remarks
   * For node-only packages (e.g. mcp — its macro tests load esbuild-wasm, which fails under
   * jsdom with realm-mismatched TextEncoder/Uint8Array).
   */
  nodeOnly?: boolean;
  /**
   * Run this package's universal (`*.test.{js,ts}`) tests under Node only.
   *
   * @defaultValue `false`
   *
   * @remarks
   * The package-rooted counterpart of {@link nodeOnlyUniversalPackages} — that list is written in
   * repo-root-relative paths and cannot match when vitest's root IS the package. A package on that
   * list should set this too, or the same suite behaves differently depending on which directory
   * it was launched from.
   *
   * Unlike {@link CreateVitestConfigOptions.nodeOnly} the Browser project survives, so a
   * `*.jsdom.test.ts` still runs.
   */
  nodeOnlyUniversal?: boolean;
}

export function createVitestConfig(options?: CreateVitestConfigOptions) {
  const projects: object[] = [
    {
      // `projects` are isolated — each needs the plugin, since the root runner resolves `@sheetxl/*`
      // to SOURCE and so hits the `virtual:sheetxl/bundled-locale` import in each package's locale
      // registration. Without it every test pulling in sdk/react fails to resolve that import. (The
      // other config surfaces that need it are `createLibraryConfig` and the storybook config.)
      plugins: [LocaleBundlePlugin()],
      test: {
        name: 'Node.js',
        environment: 'node',
        maxWorkers,
        execArgv,
        setupFiles: [
          path.join(_configDir, 'vitest.node.setup.ts'),
          path.join(_configDir, 'vitest.setup.ts')
        ],
        include: formulaOnly ? [formulaTests] : [
          '**/*.test.{js,ts}',     // Universal tests run here
          '**/*.node.test.{js,ts}' // Node-specific tests
        ],
        exclude: [
          ...sharedExclude,
          ...formulaExclude,
          '**/*.jsdom.test.{js,ts}' // Exclude jsdom-specific tests
        ],
        testTimeout,
      }
    }
  ];
  // `formulaOnly` skips the Browser project outright: every formula test is sdk's, and sdk's
  // universal tests never run there anyway, so the project would only cost a second empty pool.
  if (!options?.nodeOnly && !formulaOnly) {
    projects.push({
      plugins: [LocaleBundlePlugin()],
      test: {
        name: 'Browser',
        environment: 'jsdom',
        maxWorkers,
        execArgv,
        setupFiles: [
          path.join(_configDir, 'vitest.jsdom.setup.ts'),
          path.join(_configDir, 'vitest.setup.ts')
        ],
        include: [
          '**/*.test.{js,ts}',      // Universal tests run here
          '**/*.jsdom.test.{js,ts}' // jsdom-specific tests
        ],
        exclude: [
          ...sharedExclude,
          ...formulaExclude,
          '**/*.node.test.{js,ts}', // Exclude Node-specific tests
          // The MCP server is Node-only. Its macro tests load esbuild-wasm,
          // which fails under jsdom (realm-mismatched TextEncoder/Uint8Array).
          'packages/mcp/**',
          // Universal tests that are Node-only by policy, not by capability.
          ...nodeOnlyUniversalPackages.map((pkg) => excludeUniversal(`${pkg}/**/`)),
          ...(options?.nodeOnlyUniversal ? [excludeUniversal('**/')] : [])
        ],
        testTimeout,
      }
    });
  }

  return defineConfig({
    resolve: {
      tsconfigPaths: true
    },
    test: {
      projects,
      // Machine-wide run serialization. Root-level (NOT per project) so it runs once per invocation
      // rather than once per pool. See the file for why the lock lives here and not in a wrapper.
      globalSetup: [path.join(_configDir, 'vitest.globalSetup.ts')],
      // Coverage configuration - only enabled when running with --coverage flag
      coverage: {
        enabled: false, // Disabled by default, enable with --coverage flag
        provider: 'v8',
      }
    }
  });
}
