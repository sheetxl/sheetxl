/**
 * Command-catalog build core (I18N-DESIGN.md decision 8 + decision 1). Shared by the Vite plugin
 * (`config/vite-plugin-i18n.ts`) and the CLI (`scripts/i18n-catalog.mjs`).
 *
 * Per package it:
 *  - reads the authored English default catalogs `locales/en/<name>.cmd.json` (source of truth),
 *  - validates them + every locale overlay (no EXTRA keys),
 *  - produces SPARSE per-locale packs — untranslated text is simply ABSENT, and
 *  - emits a `manifest.json` (available locales + the catalog→scope/sourceId map the loader needs).
 *
 * **Sparse, not English-filled.** Backfilling English made every pack look complete: a translator
 * could not see what was left to do without diffing against `en`, and a user got scattered English
 * that read as finished work. Absence is now the signal — an untranslated string renders as its KEY,
 * which is loud in the UI and unambiguous in the file. A locale that genuinely wants another language
 * behind it says so with `inherit` in its manifest, resolved at load time.
 *
 * Non-text fields (icon / shortcut / tags / borrow / params / groupIcons) are still copied from
 * English: they are structure, not translation, and a missing icon helps nobody.
 *
 * **Presence is the only signal.** A value that is there was written by a translator; a value that is
 * not is missing. Nothing needs to know whether a translation happens to equal English — "Link" in
 * German is simply the translation. The old `known-identical.json` baseline existed solely to keep
 * such values out of the TODO count back when everything was English-filled and identity was
 * therefore ambiguous; with sparse packs the ambiguity is gone and so is the file.
 *
 * `todos` counts what English has and the locale does not — a build/validation report, never a
 * runtime concern.
 */
import fs from 'node:fs';
import path from 'node:path';

const TEXT_FIELDS = ['label', 'description'];
const ENGLISH = 'en';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n');

/**
 * Whether the locale file at `p` already holds `o` as the build writes it - same keys, same order.
 * Compared parsed, so whitespace and line endings do not count. A hand edit that puts a key out of
 * place is otherwise rewritten by every build and shows up as a change nobody made.
 */
const isWrittenAs = (p, o) => fs.existsSync(p) && JSON.stringify(readJson(p)) === JSON.stringify(o);

/** `clipboard.cmd.json` → `clipboard` (the source id; scope comes from the catalog's `scope` field). */
const sourceIdOf = (file) => file.replace(/\.cmd\.json$/, '');

/**
 * Endings that mark a CALL-SITE (`t()`) message catalog — a flat `key → message` map.
 *
 * The stem is the package's own (`ui.msg.json`, `model.msg.json`, or a split like
 * `errors.msg.json`), so the type is carried by the ending rather than by a magic filename.
 * There is no alias: a hand-made pack uses the same convention, so there is one way to name one.
 */
const MESSAGE_SUFFIX = '.msg.json';
const isMessagesFile = (f) => f.endsWith(MESSAGE_SUFFIX);

/**
 * Reconcile one locale's flat `messages.json` against English: keep the keys it translates (sorted,
 * for stable diffs), report keys that no longer exist in `en` as EXTRA, and count the ones it lacks
 * as TODO. Returns the sparse catalog plus its counts.
 */
function reconcileUi(en, loc) {
  const out = {};
  let todos = 0;
  const extras = Object.keys(loc).filter((k) => !(k in en));
  for (const key of Object.keys(en).sort()) {
    const value = loc[key];
    if (value === undefined) { todos++; continue; } // absent = untranslated, and stays absent
    out[key] = value;
  }
  return { catalog: out, todos, extras };
}

/**
 * Reconcile a locale catalog against English in place; returns { added, todos, extras }.
 *
 * Structural fields are copied down; TEXT fields are left exactly as the translator wrote them, so
 * the result is SPARSE and `todos` counts what English has that this locale does not.
 */
function reconcile(en, loc) {
  let added = 0, todos = 0;
  const extras = [];
  /** A TEXT value is present or it is missing — nothing else to decide. */
  const present = (value) => {
    if (value !== undefined) return true;
    todos++;
    return false;
  };

  loc.scope = en.scope;
  loc.version = en.version;
  if (en.label !== undefined && !present(loc.label)) delete loc.label;
  loc.commands = loc.commands ?? {};
  for (const key of Object.keys(loc.commands)) if (!(key in en.commands)) extras.push(key);
  for (const [key, enRec] of Object.entries(en.commands)) {
    const locRec = loc.commands[key] ?? (loc.commands[key] = {});
    // `params` = message-parameter DEFAULTS; `groupIcons` = per-surface glyphs. Neither translates.
    for (const f of ['icon', 'groupIcons', 'tags', 'borrow', 'params']) {
      if (enRec[f] !== undefined) locRec[f] = enRec[f]; else delete locRec[f];
    }
    // `shortcut` is USUALLY structure (inherit English so en changes propagate),
    // but MAY be a localized mnemonic override (e.g. de Bold = ctrl+shift+F for
    // "Fett"). Preserve a locale shortcut that intentionally differs from English;
    // inherit English when it is missing or identical (an un-overridden copy).
    //
    // `null` is the THIRD state — "this locale has no binding for this command" — and follows the
    // repo-wide convention (`undefined` = default it, `null` = exclude it). Absence cannot express
    // it, because absence means inherit: hand-deleting a locale shortcut looks right, ships, and
    // then comes straight back on the next sync (or dev/build, which runs this same reconcile).
    // It is needed whenever a localized mnemonic takes a chord English uses elsewhere — de Bold is
    // ctrl+shift+F, so de `formatCellsFont` cannot also claim it and must say so explicitly.
    if (enRec.shortcut === undefined) {
      delete locRec.shortcut;
    } else if (locRec.shortcut === null) {
      // Explicitly unbound in this locale — leave it exactly as authored.
    } else if (locRec.shortcut === undefined ||
               JSON.stringify(locRec.shortcut) === JSON.stringify(enRec.shortcut)) {
      locRec.shortcut = enRec.shortcut;
    }
    // Per-surface TEXT maps: same fill + TODO accounting as the plain text fields, per groupKey.
    for (const mapField of ['groupLabels', 'groupDescriptions']) {
      if (!enRec[mapField]) { delete locRec[mapField]; continue; }
      locRec[mapField] = locRec[mapField] ?? {};
      for (const gk of Object.keys(locRec[mapField])) if (!(gk in enRec[mapField])) delete locRec[mapField][gk];
      for (const gk of Object.keys(enRec[mapField])) {
        if (!present(locRec[mapField][gk])) delete locRec[mapField][gk];
      }
      if (Object.keys(locRec[mapField]).length === 0) delete locRec[mapField];
    }
    for (const f of TEXT_FIELDS) {
      if (enRec[f] === undefined) { delete locRec[f]; continue; }
      if (!present(locRec[f])) delete locRec[f];
    }
  }
  return { added, todos, extras };
}

/** Key-order a locale catalog like the English default (stable diffs). */
function orderLike(en, loc, tag) {
  const ordered = { $schema: en.$schema, scope: en.scope, label: loc.label ?? en.label, tag, version: en.version, commands: {} };
  for (const key of Object.keys(en.commands)) if (loc.commands[key]) ordered.commands[key] = loc.commands[key];
  return ordered;
}

/**
 * Build + validate one package's catalogs.
 * @param {string} pkgRoot absolute package dir (contains `locales/`)
 * @param {{ write?: boolean, out?: string, logger?: {info,warn,error} }} [opts]
 *   `write` persists complete packs + manifest (into `out` or `locales/`); otherwise validate-only.
 * @returns {{ catalogs: number, locales: string[], problems: number, todos: number } | null} null if no catalogs
 */
export function buildPackageCatalogs(pkgRoot, opts = {}) {
  const log = opts.logger ?? console;
  const localesDir = path.join(pkgRoot, 'resources', 'locales');
  const enDir = path.join(localesDir, ENGLISH);
  if (!fs.existsSync(enDir)) return null;

  const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith('.cmd.json'));
  // Several `*.msg.json` may split one package's call-site text (the SDK's errors vs conditions vs
  // functions, say); each reconciles independently against its English counterpart.
  const enMsgFiles = fs.readdirSync(enDir).filter((f) => isMessagesFile(f));
  if (enFiles.length === 0 && enMsgFiles.length === 0) return null;

  const outDir = opts.out ? path.resolve(pkgRoot, opts.out) : localesDir;
  // A locale dir counts if it carries EITHER command catalogs or call-site messages — a package may
  // ship only one of the two (`utils-mui` has only `t()` strings; `react` only commands).
  const isLocaleFile = (f) => f.endsWith('.cmd.json') || isMessagesFile(f);
  const locales = fs.readdirSync(localesDir).filter((d) => {
    const full = path.join(localesDir, d);
    return fs.statSync(full).isDirectory() && d !== ENGLISH && fs.readdirSync(full).some(isLocaleFile);
  });

  let problems = 0, todos = 0;
  const catalogsMeta = [];

  for (const file of enFiles) {
    const en = readJson(path.join(enDir, file));
    if (!en.scope) { log.error(`${file}: missing "scope"`); problems++; }
    catalogsMeta.push({ file, scope: en.scope, sourceId: sourceIdOf(file) });

    // Copy the English default into the output as-is (it is already a complete pack).
    if (opts.write) {
      const enOut = path.join(outDir, ENGLISH);
      fs.mkdirSync(enOut, { recursive: true });
      if (path.resolve(enOut) !== path.resolve(enDir)) writeJson(path.join(enOut, file), en);
    }

    for (const tag of locales) {
      const lp = path.join(localesDir, tag, file);
      const loc = fs.existsSync(lp) ? readJson(lp) : { tag, commands: {} };
      loc.tag = tag;
      const { todos: t, extras } = reconcile(en, loc);
      todos += t;
      if (extras.length) { log.error(`${tag}/${file}: EXTRA keys not in English: ${extras.join(', ')}`); problems++; }
      if (opts.write) {
        const locOut = path.join(outDir, tag);
        fs.mkdirSync(locOut, { recursive: true });
        writeJson(path.join(locOut, file), orderLike(en, loc, tag));
      } else if (fs.existsSync(lp) && !isWrittenAs(lp, orderLike(en, loc, tag))) {
        log.error(`${tag}/${file}: not as the build writes it (run \`pnpm i18n:catalog --sync\`)`); problems++;
      }
    }
  }

  // --- Call-site (`t()`) messages: the same sparse-per-locale model as the command catalogs, so a
  // package ships its OWN translations for its own dialog/tooltip strings instead of leaving them to
  // a host pack (I18N-DESIGN.md decision 6). Flat `key → message`; `en/messages.json` is extractor-generated.
  for (const msgFile of enMsgFiles) {
    const enUi = readJson(path.join(enDir, msgFile));
    if (opts.write) {
      const enOut = path.join(outDir, ENGLISH);
      fs.mkdirSync(enOut, { recursive: true });
      if (path.resolve(enOut) !== path.resolve(enDir)) writeJson(path.join(enOut, msgFile), enUi);
    }
    for (const tag of locales) {
      const lp = path.join(localesDir, tag, msgFile);
      const loc = fs.existsSync(lp) ? readJson(lp) : {};
      const { catalog, todos: t, extras } = reconcileUi(enUi, loc);
      todos += t;
      if (extras.length) { log.error(`${tag}/${msgFile}: EXTRA keys not in English: ${extras.join(', ')}`); problems++; }
      if (opts.write) {
        const locOut = path.join(outDir, tag);
        fs.mkdirSync(locOut, { recursive: true });
        writeJson(path.join(locOut, msgFile), catalog);
      } else if (fs.existsSync(lp) && !isWrittenAs(lp, catalog)) {
        log.error(`${tag}/${msgFile}: not as the build writes it (run \`pnpm i18n:catalog --sync\`)`); problems++;
      }
    }
  }

  const allLocales = [ENGLISH, ...locales];
  if (opts.write) {
    for (const locale of allLocales) fs.mkdirSync(path.join(outDir, locale), { recursive: true });
  }

  // No `manifest.json` is emitted any more — neither the package index nor the per-locale one. Both
  // were build artifacts describing a directory, which is exactly what `contents.json` now does for
  // every resource kind (`ResourcesPlugin` writes it from a scan of this output). Keeping them would
  // mean two generated descriptions of the same directory, drifting apart, under a filename that
  // already means three other things in this repo.
  return { catalogs: enFiles.length, locales: allLocales, problems, todos };
}
