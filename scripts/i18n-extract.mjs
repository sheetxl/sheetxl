/**
 * i18n extraction — the CALL-SITE strings only.
 *
 * Command chrome (and command-BUTTON/panel/tab entries, which are just commands with a different
 * rendering surface) is now AUTHORED as data in the per-scope catalogs
 * (`packages/<pkg>/resources/locales/<tag>/*.cmd.json`) and validated by `scripts/i18n-catalog.mjs` / the i18n
 * Vite plugin — nothing extracts it from TS any more.
 *
 * What's left is the `t('key', 'English')` boundary for non-command prose (formula bar, status bar,
 * dialogs, toasts): the English literal at the call site IS the `en` value, so this walk derives
 * `packages/<pkg>/resources/locales/en/messages.json` for packs to translate against.
 *
 * **Dependency-owned keys are not restated.** The runtime merges every package's catalog into one
 * keyspace per language (LanguagePackService slices), so a KEY-ONLY declaration whose key a
 * workspace dependency already ships resolves upstream and is kept OUT of this package's file —
 * a local copy adds nothing and drifts (two shipped copies of `op.updateProtectedRange` once
 * disagreed, and only one ever rendered). To deliberately re-word a dependency's key, use the
 * INLINE-ENGLISH form (`t('key', 'New wording')`): it stays in this package's catalog and wins at
 * runtime, where the LAST registration (the downstream package) takes precedence.
 *
 * Usage: node scripts/i18n-extract.mjs [--list] [pkgName ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_PACKAGES = [
  // `sdk` owns model-layer text that surfaces in host UI (condition operator titles, model errors).
  // It is framework-free and registers its slice through `registerPackageMessages`, but the strings
  // are declared with the same `t()` / `messageKey()` boundary, so they extract identically.
  'sdk',
  'utils-react', 'utils-mui', 'grid-react', 'react',
  'scripting-react', 'scripting-mui', 'studio-mui'
];

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
// `--check`: derive the catalogs but WRITE NOTHING — compare against what is committed and fail if
// they differ. This is the parity gate (formerly a CI-only `git diff --exit-code`), but done in
// memory so it runs identically on every platform (no shell glob, no git) — usable in `pnpm validate`
// and the pre-commit hook on Windows too.
const checkOnly = args.includes('--check');
const pkgNames = args.filter((a) => !a.startsWith('--'));
const packages = pkgNames.length ? pkgNames : DEFAULT_PACKAGES;

/** Recursively collect .ts/.tsx sources (skip tests/stories/dist). */
function collectSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/^(__tests__|__mocks__|node_modules|dist)$/.test(entry.name)) continue;
      collectSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** A string literal or substitution-free template → its text; else undefined. */
function literalText(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

/**
 * Call forms that declare a catalog key. TWO authoring styles, both valid:
 *
 *  - **Inline English** — `t('key', 'English')` / `messageKey('key', 'English')`. The literal IS the
 *    catalog value; the call site owns the English. Right for prose whose wording only makes sense
 *    where it is written (dialog copy, a toast).
 *
 *  - **Key only** — `t('key')` / `messageKey('key')`. The English lives in `en/messages.json` and
 *    nowhere else. Right when the key already names the string as precisely as a literal would
 *    (`condition.operator.textEmail.title`), where repeating "Is Email" adds no clarity for a reader
 *    and ships the same bytes twice — once in the JS bundle, once in the JSON that is fetched anyway.
 *    The extractor still owns the key SET (a removed call still drops its key, so nothing rots); it
 *    just takes the VALUE from the existing English catalog instead of the source.
 */
const MESSAGE_DECLARING_CALLS = new Set(['t', 'messageKey']);

/** Workspace map: package NAME → `{ dir, deps }` (runtime deps only), read once. */
function workspacePackages() {
  const byName = new Map();
  for (const dir of fs.readdirSync(path.join(repoRoot, 'packages'))) {
    const pj = path.join(repoRoot, 'packages', dir, 'package.json');
    if (!fs.existsSync(pj)) continue;
    const json = JSON.parse(fs.readFileSync(pj, 'utf8'));
    if (!json.name) continue;
    byName.set(json.name, {
      dir,
      // What can register message slices before this package's module init: its runtime imports.
      deps: [...Object.keys(json.dependencies ?? {}), ...Object.keys(json.peerDependencies ?? {})]
    });
  }
  return byName;
}

/**
 * The merged English every TRANSITIVE workspace dependency of `pkgName` already ships — the key set
 * a key-only declaration may resolve against instead of restating locally. Merged dependencies-first
 * so a nearer dependency overwrites a deeper one, mirroring the runtime's last-registration-wins
 * precedence (module init runs dependencies before dependents).
 */
function upstreamEnglish(pkgName, byName) {
  const merged = {};
  const visited = new Set([pkgName]); // never read the package's own catalog as "upstream"
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const entry = byName.get(name);
    if (!entry) return; // external dependency — ships no catalogs we manage
    for (const dep of entry.deps) visit(dep);
    const enDir = path.join(repoRoot, 'packages', entry.dir, 'resources', 'locales', 'en');
    if (!fs.existsSync(enDir)) return;
    for (const f of fs.readdirSync(enDir)) {
      if (!f.endsWith('.msg.json')) continue;
      Object.assign(merged, JSON.parse(fs.readFileSync(path.join(enDir, f), 'utf8')));
    }
  };
  for (const dep of byName.get(pkgName)?.deps ?? []) visit(dep);
  return merged;
}

/** Walk for the message-declaring calls above. */
function extractFile(sourceFile, catalog, conflicts, stats, hidden) {
  const relFile = path.relative(repoRoot, sourceFile.fileName).replace(/\\/g, '/');
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        MESSAGE_DECLARING_CALLS.has(node.expression.text) && node.arguments.length >= 1) {
      const keyArg = node.arguments[0];
      const key = literalText(keyArg);
      // A key BUILT inline — `t(cond ? 'a' : 'b')`, `t(`x.${y}`)` — hides literal keys from this walk:
      // the strings live only at the call site yet never reach the catalog, so re-extraction silently
      // DROPS them and CI then asks you to delete in-use messages. Fail loudly and point at the site;
      // the fix is to split into literal call sites (see HeaderResizerLayer). A bare identifier or
      // `a ?? b` reference is fine — it points at a key declared literally elsewhere.
      if (key === undefined && (ts.isConditionalExpression(keyArg) || ts.isTemplateExpression(keyArg))) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(keyArg.getStart(sourceFile));
        hidden.push(`${relFile}:${line + 1}`);
      }
      // `undefined` (no second arg, or a non-literal one) marks the KEY-ONLY form.
      const english = node.arguments.length >= 2 ? literalText(node.arguments[1]) : undefined;
      if (key !== undefined) {
        stats.calls++;
        const existing = catalog.get(key);
        if (english === undefined) {
          // Key-only: claim the key; the value is filled from the English catalog after the walk.
          // A later inline-English declaration for the same key still wins (it carries a value).
          if (existing === undefined) catalog.set(key, { text: undefined, file: relFile });
        } else if (existing !== undefined && existing.text !== undefined && existing.text !== english) {
          conflicts.push({ key, a: existing, b: { text: english, file: relFile } });
        } else {
          catalog.set(key, { text: english, file: relFile });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

let total = 0;
let missing = 0;
const hidden = [];
const stale = [];
const wsByName = workspacePackages();
const wsByDir = new Map([...wsByName].map(([name, e]) => [e.dir, name]));
for (const pkg of packages) {
  const srcDir = path.join(repoRoot, 'packages', pkg, 'src');
  if (!fs.existsSync(srcDir)) {
    console.warn(`skip ${pkg}: no src dir`);
    continue;
  }
  const catalog = new Map();
  const conflicts = [];
  const stats = { calls: 0 };
  for (const file of collectSources(srcDir)) {
    const source = ts.createSourceFile(
      file, fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest, /*setParentNodes*/ false,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    extractFile(source, catalog, conflicts, stats, hidden);
  }
  for (const c of conflicts) {
    console.warn(`CONFLICT ${c.key}:\n  "${c.a.text}" (${c.a.file})\n  "${c.b.text}" (${c.b.file})`);
  }
  if (catalog.size === 0) {
    console.log(`${pkg}: 0 call-site messages`);
    continue;
  }

  // KEY-ONLY declarations take their English from the catalog that is already on disk — that file is
  // the source of truth for those strings, so re-running extraction must preserve it rather than
  // blank it. A key with no value anywhere is a real authoring error (the string exists nowhere), so
  // it is reported and the key is written as its own text: visible in the UI, never silently empty.
  const outDir = path.join(repoRoot, 'packages', pkg, 'resources', 'locales', 'en');
  // The stem is the package's own (`ui`, `model`, …); the ending carries the type. Extraction writes
  // the file that is already there, so a package's choice survives re-running this.
  const present = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith('.msg.json'))
    : [];
  if (present.length > 1) {
    // Several message files are legal (they merge at load), but nothing here says which key belongs
    // in which — routing would have to be declared before extraction could split.
    console.error(`${pkg}: ${present.length} message catalogs (${present.join(', ')}) — `
      + `extraction cannot decide which key goes where. Merge them or extract manually.`);
    missing++;
    continue;
  }
  const outFile = path.join(outDir, present[0] ?? 'ui.msg.json');
  const existingEn = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
  // Keys a workspace dependency already ships. Extraction runs dependencies before dependents
  // (DEFAULT_PACKAGES order), so this reads catalogs regenerated moments ago, not stale ones.
  const upstream = upstreamEnglish(wsByDir.get(pkg), wsByName);
  let keyOnly = 0;
  let fromUpstream = 0;
  const unresolved = [];
  for (const [key, rec] of catalog) {
    // Inline English stays local even when a dependency ships the key: that is the deliberate
    // override form, and at runtime the downstream (later-registered) catalog wins.
    if (rec.text !== undefined) continue;
    keyOnly++;
    const owner = upstream[key];
    if (owner !== undefined) {
      const prior = existingEn[key];
      if (prior !== undefined && prior !== owner) {
        console.warn(`DROPPED DIVERGENT COPY ${key} in ${pkg}: "${prior}" (local) vs "${owner}" ` +
          `(dependency) — resolving upstream; use t('${key}', '…') inline to deliberately override.`);
      }
      catalog.delete(key);
      fromUpstream++;
      continue;
    }
    const prior = existingEn[key];
    if (prior !== undefined) rec.text = prior;
    else { rec.text = key; unresolved.push(`${key} (${rec.file})`); }
  }
  for (const u of unresolved) console.warn(`MISSING ENGLISH ${u} — key-only declaration with no entry in ${path.basename(outFile)} or any dependency catalog`);
  missing += unresolved.length;

  const sorted = Object.fromEntries(
    [...catalog.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.text])
  );
  console.log(`${pkg}: ${catalog.size} call-site messages from ${stats.calls} t() calls` +
    (keyOnly ? ` (${keyOnly} key-only)` : '') +
    (fromUpstream ? ` (${fromUpstream} resolved upstream, not restated)` : '') +
    (conflicts.length ? ` — ${conflicts.length} CONFLICTS` : '') +
    (unresolved.length ? ` — ${unresolved.length} MISSING ENGLISH` : ''));
  total += catalog.size;
  if (listOnly) continue;
  const nextContent = JSON.stringify(sorted, null, 2) + '\n';
  if (checkOnly) {
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
    if (current !== nextContent) stale.push(`packages/${pkg}/resources/locales/en/${path.basename(outFile)}`);
    continue;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, nextContent);
  console.log(`  → packages/${pkg}/resources/locales/en/${path.basename(outFile)}`);
}
console.log(`total: ${total} call-site messages`);
if (hidden.length > 0) {
  console.error(`FAILED: ${hidden.length} computed message key(s) hidden from extraction ` +
    `(ternary/template first arg) — split into literal t()/messageKey() call sites:`);
  for (const h of hidden) console.error(`  ${h}`);
  console.error(`  No command fixes this; edit the call site so each key is a literal:\n` +
    `    t(a ? 'k.one' : 'k.two')   →   a ? t('k.one') : t('k.two')\n` +
    `  then run \`pnpm i18n:extract\` in case the en catalog changed.`);
  process.exit(1);
}
if (stale.length > 0) {
  console.error(`FAILED: ${stale.length} en catalog(s) out of date — run \`pnpm i18n:extract\` and commit:`);
  for (const s of stale) console.error(`  ${s}`);
  process.exit(1);
}
if (missing > 0) {
  console.error(`FAILED: ${missing} key-only declaration(s) with no English.`);
  process.exit(1);
}
