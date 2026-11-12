/**
 * Node counterpart to `vite-plugin-locale-bundle.ts` — materializes the virtual module
 * `virtual:sheetxl/bundled-locale` for code running under **plain node** instead of vite.
 *
 * ## Why this exists
 *
 * Packages import `virtual:sheetxl/bundled-locale` to get their inlined default-language (`en`)
 * floor (see the plugin for the full rationale). That specifier is resolved at OUR build time, so a
 * consumer importing BUILT output never sees it. But a dev running package SOURCE outside vite does:
 * `--conditions=development` points `@sheetxl/sdk` at `./src/index.ts`, which reaches
 * `src/i18n/locales.ts`, which imports the virtual module — and node's ESM loader dies with
 * `ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'virtual:'`. That is every `tsx src/cli.ts` dev
 * launch of the CLI. (Vitest is unaffected: it runs the vite plugin.)
 *
 * ## How
 *
 * A `node:module` resolve hook claims the specifier and rewrites it to a `data:text/javascript` URL
 * carrying the same emitted source the plugin produces — resolved per IMPORTER, so each package gets
 * its own floor, exactly like the plugin. Keying by content also keeps two packages' floors distinct
 * without a synthetic id.
 *
 * ## Use
 *
 * Preload it; the hooks must be registered before the importing graph loads, which rules out a static
 * import from the entry (ESM resolves the whole graph before evaluating anything):
 *
 *   node --import=./config/node-locale-bundle.mjs ...        # path is CWD-relative
 *
 * A `.mjs` (not `.ts`) on purpose: NODE_OPTIONS preloads run ahead of the `tsx` registration that the
 * `tsx` launcher itself injects, so this file has to be loadable by node with no transform.
 *
 * @remarks
 * The emitted shape (which files are read, `$schema` stripping, key sorting) is duplicated from
 * `vite-plugin-locale-bundle.ts`, which stays canonical — change both together.
 */
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

export const VIRTUAL_ID = 'virtual:sheetxl/bundled-locale';

/** Walk up from a source file to its owning package directory (the nearest `package.json`). */
function findPackageDir(fromFile) {
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Emit the inlined `en` floor module for a package directory. Mirrors the plugin's `load()`. */
function buildSource(pkgDir) {
  const enDir = pkgDir ? path.join(pkgDir, 'resources', 'locales', 'en') : undefined;

  const messages = {};
  const catalogs = [];
  if (enDir && fs.existsSync(enDir)) {
    for (const file of fs.readdirSync(enDir).sort()) {
      if (file.endsWith('.msg.json')) {
        Object.assign(messages, JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8')));
      } else if (file.endsWith('.cmd.json')) {
        const catalog = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
        delete catalog.$schema; // authoring aid only; not part of the CommandCatalog shape
        catalogs.push({ sourceId: file.replace(/\.cmd\.json$/, ''), catalog });
      }
    }
  }
  // Key-sorted so the emitted module is deterministic regardless of readdir order.
  const sorted = Object.fromEntries(Object.entries(messages).sort(([a], [b]) => a.localeCompare(b)));
  return `export const messages = ${JSON.stringify(sorted)};\n`
    + `export const catalogs = ${JSON.stringify(catalogs)};\n`;
}

let _registered = false;

/** Register the resolve hook. Idempotent; hooks cannot be removed, so this is process-lifetime. */
export function registerBundledLocaleHooks() {
  if (_registered) return;
  _registered = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier !== VIRTUAL_ID) return nextResolve(specifier, context);
      const parentURL = context.parentURL;
      const pkgDir = parentURL?.startsWith('file:') ? findPackageDir(fileURLToPath(parentURL)) : undefined;
      // An unresolvable importer emits an EMPTY floor rather than throwing: every `t(key)` then
      // renders its key, which is the same degraded-but-alive path a failed pack registration takes.
      return {
        url: `data:text/javascript,${encodeURIComponent(buildSource(pkgDir))}`,
        format: 'module',
        shortCircuit: true
      };
    }
  });
}

registerBundledLocaleHooks();
