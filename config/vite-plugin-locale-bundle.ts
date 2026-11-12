import { type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Vite plugin: inline a package's **bundled default-language (`en`) locale** into the code bundle.
 *
 * ## Why this exists
 *
 * i18n strings ship as JSON packs FETCHED at runtime from a served `/resources` path (see
 * `vite-plugin-resources.ts`) — deliberately out of the code bundle, so they are overridable and new
 * languages need no rebuild. But a plain `npm install` browser client cannot fetch from `node_modules`;
 * something has to serve those files, which is exactly the setup we do NOT want to force on a consumer.
 *
 * So each package additionally carries ONE language — the default `en` — INLINED in its code, as a
 * zero-config floor: chrome and dialog text render correctly with nothing served, while every other
 * language and any host/user override still loads through the fetch path and layers on top per key
 * (`registerDefaultMessages` / the `\0default` catalog tier).
 *
 * ## How
 *
 * A package imports the virtual module {@link VIRTUAL_ID}; this plugin resolves it, per IMPORTER, to
 * that package's own `resources/locales/en/` and emits an inlined module:
 *   - `messages`  — its merged `en/*.msg.json` call-site (`t()`) strings, and
 *   - `catalogs`  — one `{ sourceId, catalog }` per `en/*.cmd.json` command pack.
 *
 * Because it runs at OUR build time, the published `dist` already contains the inlined bytes — an
 * external client importing the built package gets the floor with zero config and no plugin. In the
 * monorepo (examples/storybook consume source) the same plugin resolves the import live from disk, so
 * the `resources/*.json` stays the single source of truth — nothing is generated into `src`.
 *
 * The virtual specifier is CONSTANT across packages; resolution is by the importer's package, so every
 * package writes the same import and gets its own floor. Types come from a tiny ambient `declare module`
 * in each importing package (its `global.d.ts`), not from this plugin.
 *
 * Code that runs package SOURCE outside vite (`tsx src/cli.ts` with `--conditions=development`) has no
 * plugin to resolve the specifier; `node-locale-bundle.mjs` is the node-hook counterpart and duplicates
 * the emit below. This file stays canonical — change both together.
 */
export const VIRTUAL_ID = 'virtual:sheetxl/bundled-locale';
/** Rollup convention: a `\0`-prefixed resolved id is opaque and not written to disk. Package dir appended so each importer resolves to its OWN floor. */
const RESOLVED_PREFIX = `\0${VIRTUAL_ID}:`;

/** Walk up from a source file to its owning package directory (the nearest `package.json`). */
function findPackageDir(fromFile: string): string | undefined {
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function LocaleBundlePlugin(): Plugin {
  return {
    name: 'sheetxl-locale-bundle',
    enforce: 'pre',

    resolveId(source, importer) {
      if (source !== VIRTUAL_ID || !importer) return null;
      const pkgDir = findPackageDir(importer);
      // A distinct resolved id per package: the same virtual specifier must NOT collapse sdk's and
      // react's floors into one cached module when several packages are built/served together (dev).
      return pkgDir ? RESOLVED_PREFIX + pkgDir : null;
    },

    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;
      const enDir = path.join(id.slice(RESOLVED_PREFIX.length), 'resources', 'locales', 'en');

      const messages: Record<string, string> = {};
      const catalogs: { sourceId: string; catalog: Record<string, unknown> }[] = [];
      if (fs.existsSync(enDir)) {
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
  };
}
