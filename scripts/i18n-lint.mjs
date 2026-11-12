/**
 * NOTE (2026-07-18): no longer part of `pnpm i18n:lint`. Per-package call-site catalogs
 * (`locales/<tag>/messages.json`) are now reconciled + completeness-checked by the catalog build
 * (`config/i18n-catalog-build.mjs`, run via `scripts/i18n-catalog.mjs`), the same pipeline the
 * command catalogs use — so package parity is enforced there. This script remains for auditing an
 * EXTERNAL / host-supplied pack (e.g. a `@sheetxl/lang-de` meta-pack) against the English union:
 *   node scripts/i18n-lint.mjs path/to/pack.json
 *
 * i18n parity lint (the IronCalc `lint-i18n.js` idea) — asserts language packs stay in
 * lockstep with the extracted English catalogs:
 *   - MISSING: an `en` key the pack does not translate (fallback to English — a coverage gap)
 *   - UNUSED:  a pack key that no longer exists in `en` (rot — fails the lint)
 *
 * Run `node scripts/i18n-extract.mjs` first (or in the same CI step) so `en` is current.
 *
 * Usage: node scripts/i18n-lint.mjs <pack.json|pack dir> [--strict]
 *   --strict  missing keys also fail (default: only unused/rotted keys fail)
 *
 * A pack file is either a bare catalog `{ "cmd…": "…" }` or a `{ tag, ui: { … } }` pack.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
// `--packs`: lint every in-repo NON-en `*.msg.json` language pack for rot, discovered here rather
// than by a shell `find | grep` (which differs cmd vs bash) so CI and a Windows `pnpm validate` agree.
const packsMode = args.includes('--packs');
const targets = args.filter((a) => !a.startsWith('--'));
if (packsMode) targets.push(...discoverMsgPacks());
if (targets.length === 0) {
  if (packsMode) { console.log('no non-en *.msg.json packs to lint'); process.exit(0); }
  console.error('usage: node scripts/i18n-lint.mjs <pack.json ...> [--strict] [--packs]');
  process.exit(2);
}

/** Source language packs: `packages/<pkg>/resources/locales/<tag>/*.msg.json`, tag !== en, no build/dist. */
function discoverMsgPacks() {
  const out = [];
  const skip = new Set(['node_modules', 'build', 'dist']);
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!skip.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.name.endsWith('.msg.json')) {
        const norm = path.join(dir, e.name).replace(/\\/g, '/');
        // Exactly one <tag> segment between `locales/` and the file (skips aggregated `@scope/pkg/…`).
        if (/\/resources\/locales\/[^/]+\/[^/]+\.msg\.json$/.test(norm) && !norm.includes('/resources/locales/en/')) {
          out.push(path.join(dir, e.name));
        }
      }
    }
  };
  walk(path.join(repoRoot, 'packages'));
  return out;
}

// Union of all extracted en catalogs (per-package, host-aggregated — same as runtime).
const en = new Map();
const pkgsDir = path.join(repoRoot, 'packages');
for (const pkg of fs.readdirSync(pkgsDir)) {
  // Call-site (`t()`) strings only — command + button/group chrome lives in the per-scope catalogs
  // (`locales/<tag>/*.cmd.json`) and is validated by scripts/i18n-catalog.mjs.
  // Several `*.msg.json` may split one package's text; they merge into one key space.
  const enDir = path.join(pkgsDir, pkg, 'resources', 'locales', 'en');
  if (!fs.existsSync(enDir)) continue;
  for (const f of fs.readdirSync(enDir)) {
    if (!f.endsWith('.msg.json')) continue;
    for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(path.join(enDir, f), 'utf8')))) {
      en.set(key, value);
    }
  }
}
if (en.size === 0) {
  console.error('no en catalogs found — run scripts/i18n-extract.mjs first');
  process.exit(2);
}
console.log(`en catalog: ${en.size} keys`);

/** Pack ui keys from a .ts/.tsx pack module: the string keys of its `ui: { … }` literal. */
function keysFromTsPack(file) {
  const source = ts.createSourceFile(
    file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const keys = new Set();
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) &&
        (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
        node.name.text === 'ui' &&
        ts.isObjectLiteralExpression(node.initializer)) {
      for (const p of node.initializer.properties) {
        if (ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name))) {
          keys.add(p.name.text);
        }
      }
      return; // one pack per file
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return keys;
}

let failed = false;
let rotCount = 0;
for (const target of targets) {
  const file = path.resolve(target);
  let keys;
  if (/\.tsx?$/.test(file)) {
    keys = keysFromTsPack(file);
  } else {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    keys = new Set(Object.keys(raw.ui ?? raw));
  }
  const missing = [...en.keys()].filter((k) => !keys.has(k));
  const unused = [...keys].filter((k) => !en.has(k));

  // `--packs` (the CI/validate gate) stays QUIET: `missing` is expected English fallback, not a
  // problem, and dumping ~1000 keys per pack is pure noise. Only UNUSED (rot) is a failure, so only
  // that is printed; a one-line summary reports success. Linting a pack BY HAND keeps the full report.
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  if (!packsMode) {
    const covered = en.size - missing.length;
    console.log(`\n${target}: ${covered}/${en.size} covered (${(100 * covered / en.size).toFixed(1)}%)`);
  }
  if (unused.length) {
    console.log(`${packsMode ? '' : '  '}UNUSED (${unused.length}) in ${rel} — keys no longer in en:`);
    for (const k of unused) console.log(`    ${k}`);
    failed = true;
    rotCount += unused.length;
  }
  if (missing.length && !packsMode) {
    console.log(`  missing (${missing.length})${strict ? ' — FAIL (--strict)' : ''}:`);
    for (const k of missing.slice(0, 20)) console.log(`    ${k}`);
    if (missing.length > 20) console.log(`    … +${missing.length - 20} more`);
  }
  if (missing.length && strict) failed = true;
}
if (packsMode) {
  console.log(rotCount === 0
    ? `✓ ${targets.length} language pack(s): no rotted keys (untranslated keys fall back to English, by design)`
    : `✗ ${rotCount} rotted key(s) across language packs — remove them (no longer in en).`);
}
process.exit(failed ? 1 : 0);
