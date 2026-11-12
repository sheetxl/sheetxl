/**
 * Command-catalog locale CLI — the manual counterpart of the i18n Vite plugin (which runs the same
 * `buildPackageCatalogs` at build/dev). Operates on every package that owns a `locales/` dir.
 *
 *   node scripts/i18n-catalog.mjs            # status + TODO summary
 *   node scripts/i18n-catalog.mjs --sync     # regenerate complete locale packs + manifest (writes)
 *   node scripts/i18n-catalog.mjs --check     # validate only (CI); non-zero on problems
 *   node scripts/i18n-catalog.mjs --init de   # scaffold locales/de/<name>.cmd.json from English
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPackageCatalogs } from '../config/i18n-catalog-build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : args.includes('--init') ? 'init' : args.includes('--sync') ? 'sync' : 'status';
const initTag = mode === 'init' ? args[args.indexOf('--init') + 1] : null;

const packagesDir = path.join(repoRoot, 'packages');
const pkgRoots = fs.readdirSync(packagesDir)
  .map((p) => path.join(packagesDir, p))
  .filter((r) => fs.existsSync(path.join(r, 'resources', 'locales', 'en')));

let problems = 0;
for (const pkgRoot of pkgRoots) {
  const rel = path.relative(repoRoot, pkgRoot).replace(/\\/g, '/');

  if (mode === 'init' && initTag) {
    // Scaffold each English catalog as a locale sibling (buildPackageCatalogs then fills + orders it).
    const enDir = path.join(pkgRoot, 'resources', 'locales', 'en');
    const locDir = path.join(pkgRoot, 'resources', 'locales', initTag);
    fs.mkdirSync(locDir, { recursive: true });
    for (const f of fs.readdirSync(enDir).filter((f) => f.endsWith('.cmd.json'))) {
      const lp = path.join(locDir, f);
      if (!fs.existsSync(lp)) fs.writeFileSync(lp, JSON.stringify({ tag: initTag, commands: {} }, null, 2) + '\n');
    }
  }

  const result = buildPackageCatalogs(pkgRoot, { write: mode === 'sync' || mode === 'init' });
  if (!result) continue;
  problems += result.problems;
  console.log(`${rel}: ${result.catalogs} catalogs, locales [${result.locales.join(', ')}]` +
    (result.todos ? `, ${result.todos} TODO` : '') + (result.problems ? ` — ${result.problems} PROBLEM(S)` : ''));
}

if (mode === 'check' && problems > 0) { console.error(`FAILED: ${problems} problem(s).`); process.exit(1); }
process.exit(problems > 0 ? 1 : 0);
