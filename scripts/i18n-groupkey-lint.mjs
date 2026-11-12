/**
 * i18n GROUP-KEY parity lint — the structural companion to `i18n-lint.mjs` (which checks
 * pack↔en key parity). This one checks that every scoped-label group key is REAL and NAMED
 * to convention, catching the class of drift that repeatedly slipped through hand-sweeps:
 *
 *   - ORPHAN:      a `cmd.<key>.label@<groupKey>` (or `.desc@…`) in the en catalog whose
 *                  `<groupKey>` is passed by NOTHING — no registered command-button panel and
 *                  no `groupKey="…"` literal in source. The compact label can never resolve
 *                  (a dead / mis-keyed label — e.g. the old `@insert`, `@delete`, `@gridlines`).
 *                  → FAILS (unless allow-listed below with a reason).
 *
 *   - CONVENTION:  a group key that carries labels but is NOT `…Options` and not exempt.
 *                  Rule (Michael, 2026-07-17): a menu / split-button GROUP key ends in
 *                  `Options` (so it can't shadow a same-named command — the reason the suffix
 *                  exists). Ribbon TOOLBARS keep `…Toolbar`; a handful of top-level surfaces
 *                  are exempt (see EXEMPT). → reported; FAILS only with `--strict-convention`.
 *
 * "Valid context" is derived STATICALLY, so a group key passed only through a *variable*
 * (`groupKey={scope}`) can read as a false orphan — allow-list it with a note if so.
 *
 * Run `node scripts/i18n-extract.mjs` first so the en catalogs are current.
 * Usage: node scripts/i18n-groupkey-lint.mjs [--strict-convention]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const strictConvention = process.argv.slice(2).includes('--strict-convention');

/**
 * Group keys that legitimately carry compact labels WITHOUT the `Options` suffix — top-level
 * surfaces and scopes, not split-button "Options" groups. (Ribbon `…Toolbar` keys are exempt
 * by suffix, below.)
 */
const EXEMPT = new Set([
  'view', 'sheet', 'cellStyle', 'namedItem',
  'contextMenu', 'movableContextMenu', 'sheetTabMenu', 'workbook'
]);

/**
 * Known ORPHAN group keys that are intentionally not-yet-wired — reported but NOT failed.
 * Keep each entry paired with the reason/date so it doesn't rot into a silent suppression.
 */
const ALLOWLIST_ORPHANS = new Map([
  // (empty) — every scoped-label group key currently resolves to a real render context.
]);

/** Recursively collect .ts/.tsx sources (skip tests/stories/dist/build). */
function collectSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/^(__tests__|__mocks__|node_modules|dist|build)$/.test(entry.name)) continue;
      collectSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const literalText = (n) =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;

/** Valid render contexts: every registered command-button `key` + every `groupKey="…"` literal. */
function collectContexts() {
  const contexts = new Set();
  const pkgsDir = path.join(repoRoot, 'packages');
  for (const pkg of fs.readdirSync(pkgsDir)) {
    const srcDir = path.join(pkgsDir, pkg, 'src');
    if (!fs.existsSync(srcDir)) continue;
    for (const file of collectSources(srcDir)) {
      const source = ts.createSourceFile(
        file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      // Same-file `const NAME = { … }` initializers, so an entry passed by name still resolves.
      const constObjects = new Map();
      const collectConsts = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
            ts.isObjectLiteralExpression(node.initializer)) {
          constObjects.set(node.name.text, node.initializer);
        }
        ts.forEachChild(node, collectConsts);
      };
      collectConsts(source);
      const visit = (node) => {
        // `<registry>.register({ key: '…', … })` — the panel/entry key IS its members' groupKey.
        // `registerMovableToolbarEntry(type, { key: '…', … })` and
        // `contributeContextualToolbar({ key: '…', … })` wrap the same register call.
        let entryArg = !ts.isCallExpression(node) ? undefined
          : ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register'
            ? node.arguments[0]
            : ts.isIdentifier(node.expression) && node.expression.text === 'registerMovableToolbarEntry'
              ? node.arguments[1]
              : ts.isIdentifier(node.expression) && node.expression.text === 'contributeContextualToolbar'
                ? node.arguments[0]
                : undefined;
        if (entryArg && ts.isIdentifier(entryArg)) entryArg = constObjects.get(entryArg.text);
        if (entryArg && ts.isObjectLiteralExpression(entryArg)) {
          for (const p of entryArg.properties) {
            if (ts.isPropertyAssignment(p) && p.name && p.name.text === 'key') {
              const k = literalText(p.initializer);
              if (k) contexts.add(k);
            }
          }
        }
        // `groupKey: '…'` (object prop) and `groupKey = '…'` (destructure default).
        if ((ts.isPropertyAssignment(node) || ts.isBindingElement(node)) &&
            node.name && ts.isIdentifier(node.name) && node.name.text === 'groupKey') {
          const init = ts.isPropertyAssignment(node) ? node.initializer : node.initializer;
          const k = literalText(init);
          if (k) contexts.add(k);
        }
        // `groupKey="…"` / `groupKey={'…'}` (JSX attribute).
        if (ts.isJsxAttribute(node) && node.name.getText(source) === 'groupKey' && node.initializer) {
          let init = node.initializer;
          if (ts.isJsxExpression(init)) init = init.expression;
          const k = literalText(init);
          if (k) contexts.add(k);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return contexts;
}

/**
 * Distinct group keys used as per-surface label overrides, read from the authored English command
 * catalogs (`locales/en/*.cmd.json` → each command's `groupLabels` keys). These are the modern form of
 * the old flat `cmd.<key>.label@<groupKey>` entries.
 */
function collectLabelScopes() {
  const scopes = new Map(); // groupKey → sample "commandKey@groupKey"
  const pkgsDir = path.join(repoRoot, 'packages');
  for (const pkg of fs.readdirSync(pkgsDir)) {
    const enDir = path.join(pkgsDir, pkg, 'resources', 'locales', 'en');
    if (!fs.existsSync(enDir)) continue;
    for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith('.cmd.json'))) {
      const catalog = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
      for (const [cmdKey, rec] of Object.entries(catalog.commands ?? {})) {
        for (const groupKey of Object.keys(rec.groupLabels ?? {})) {
          if (!scopes.has(groupKey)) scopes.set(groupKey, `${cmdKey}@${groupKey}`);
        }
      }
    }
  }
  return scopes;
}

const contexts = collectContexts();
const scopes = collectLabelScopes();
if (scopes.size === 0) {
  console.error('no scoped-label group keys found in locales/en/*.cmd.json');
  process.exit(2);
}
console.log(`contexts: ${contexts.size} registered/passed group keys · label scopes: ${scopes.size}`);

const orphans = [];
const allowed = [];
const convention = [];
for (const [gk, sample] of [...scopes].sort(([a], [b]) => a.localeCompare(b))) {
  if (!contexts.has(gk)) {
    (ALLOWLIST_ORPHANS.has(gk) ? allowed : orphans).push([gk, sample]);
    continue; // an orphan can't also be a meaningful convention target
  }
  if (!gk.endsWith('Options') && !gk.endsWith('Toolbar') && !EXEMPT.has(gk)) {
    convention.push([gk, sample]);
  }
}

let failed = false;
if (orphans.length) {
  console.log(`\nORPHAN group keys (${orphans.length}) — label scope with no registered panel / passed groupKey:`);
  for (const [gk, sample] of orphans) console.log(`  @${gk}  (e.g. ${sample})`);
  failed = true;
}
if (allowed.length) {
  console.log(`\nallow-listed orphans (${allowed.length}) — deferred, not failed:`);
  for (const [gk] of allowed) console.log(`  @${gk} — ${ALLOWLIST_ORPHANS.get(gk)}`);
}
if (convention.length) {
  console.log(`\nCONVENTION — group keys carrying labels that are not \`…Options\` / \`…Toolbar\` / exempt (${convention.length})${strictConvention ? ' — FAIL' : ''}:`);
  for (const [gk, sample] of convention) console.log(`  @${gk}  (e.g. ${sample})  → rename to ${gk}Options?`);
  if (strictConvention) failed = true;
}
if (!orphans.length && !convention.length) console.log('\n✓ no orphan or off-convention group keys');
process.exit(failed ? 1 : 0);
