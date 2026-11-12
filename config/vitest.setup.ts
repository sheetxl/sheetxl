// Build-time globals. config/vite.base.config.ts supplies these via Vite `define`, but that block is
// build-only — under test the substitution never happens and any module reading `__DEV__` at runtime
// throws `ReferenceError: __DEV__ is not defined` (e.g. dagm/ModelProperty.js). A `define` in
// vitest.config.ts does NOT fix this: Vitest's SSR transform doesn't apply it. Assigning the global
// here does, and this file is loaded by both the Node.js and Browser projects. Tests are a dev build.
(globalThis as any).__DEV__ ??= true;

// Import font setup for tests
async function setupShared(): Promise<void> {
  try {
    const { LicenseManager } = await import('../packages/sdk/src/license');
    // LicenseManager.setLicenseKey(`visit https://my.sheetxl.com to generate a license key.`);
    // Silences the license notice because tests are a dev build (`__DEV__` above); in a
    // production build a suppress only delays it.
    LicenseManager.suppressPrint('testing');

    const { TransactionStore } = await import('../packages/sdk/src/transaction');
    TransactionStore.setDefaultSync(true);

    // An anchored item (data validation, conditional format, table, protected range) that fails to
    // load warns in an app but must be LOUD here: a dropped item is indistinguishable from one that
    // was never authored, so a round-trip suite would otherwise deep-equal empty against empty and
    // pass while the reader silently lost half the file.
    const { AnchoredMap } = await import('../packages/sdk/src/anchored/AnchoredMap');
    AnchoredMap.setStrictLoad(true);

    // Register the English message packs from DISK.
    //
    // Message text now lives only in `resources/locales/<tag>/*.msg.json` — a call site passes just a
    // key (I18N-DESIGN.md decision 9). In the app those packs arrive over `fetch`; under test there is
    // no server, so without this every `t(key)` renders its KEY and any assertion on user-visible
    // wording fails. This is the Node/CLI half of the loader story: same catalogs, read locally.
    // The model/engine clone boundary. Off unless asked
    // for: `SHEETXL_CALC_CLONE=audit` records what would not survive the crossing and changes
    // nothing, `=clone` actually sends the `structuredClone`. `SHEETXL_CALC_CLONE_OUT` names a
    // DIRECTORY the run's findings are written to - one file per fork, since a scoped run forks
    // six ways and vitest swallows what a passing test logs.
    const cloneMode = process.env.SHEETXL_CALC_CLONE;
    if (cloneMode) {
      const { CloneBoundary } = await import('../packages/sdk/src/calculation/_CloneBoundary');
      CloneBoundary.setMode(cloneMode);
      const outDir = process.env.SHEETXL_CALC_CLONE_OUT;
      if (outDir) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `violations-${process.pid}.jsonl`);
        CloneBoundary.setListener((violation: unknown): void => {
          fs.appendFileSync(outFile, `${JSON.stringify(violation)}
`);
        });
      }
    }

    const { DefaultLanguagePackService } = await import('../packages/utils/src/i18n');
    const packs: Record<string, unknown> = {
      '@sheetxl/sdk': (await import('../packages/sdk/resources/locales/en/model.msg.json')).default,
      '@sheetxl/react': (await import('../packages/react/resources/locales/en/ui.msg.json')).default,
      '@sheetxl/utils-mui': (await import('../packages/utils-mui/resources/locales/en/ui.msg.json')).default,
      '@sheetxl/studio-mui': (await import('../packages/studio-mui/resources/locales/en/ui.msg.json')).default
    };
    for (const [pkg, catalog] of Object.entries(packs)) {
      DefaultLanguagePackService.registerMessages(pkg, 'en', catalog as Record<string, string>);
    }
  } catch (error: any) {
    console.warn('⚠️ Could not setup:', error.message);
  }
}

// Run font setup
await setupShared();

/**
 * Resolve the calculation engine's LAZY imports before any test runs.
 *
 * `Workbook` starts its calculation fire-and-forget (`Workbook._starting`, `Calculation.start`) —
 * deliberately, because calc is reactive and `ready()` is meant to be optional. The cost under test
 * is that a file which builds a workbook and does not await it leaves
 * `import('./compiler/FormulaCompiler')` IN FLIGHT when vitest disposes the module runner, and the
 * import then lands on a dead environment:
 *
 *   EnvironmentTeardownError: Cannot load '.../compiler/SRLexer.ts' imported from '.../SRParser.ts'
 *   after the environment was torn down
 *
 * Awaiting it here puts the module in the runner's registry, so every later `import()` of it is a
 * cache hit that never has to fetch anything — the in-flight load cannot outlive the environment
 * because there is no load. This is a harness fix for a harness-only failure: outside a test nothing
 * tears the module runner down mid-import, and the fire-and-forget start is correct as written.
 *
 * Deliberately NOT the whole `../functions` chunk, which is far larger and is what the lazy import
 * exists to keep out of a bundle that never asks for it.
 */
await import('../packages/sdk/src/calculation/compiler/FormulaCompiler');

export {};
