/**
 * i18n CHROME-OWNERSHIP lint — the third structural i18n gate, alongside `i18n-lint.mjs`
 * (pack↔en key parity) and `i18n-groupkey-lint.mjs` (group keys are real + named to convention).
 *
 * Both failure modes it catches produce the SAME symptom — English text in a German session —
 * and neither is visible to a key-parity check, because the catalog entry exists and is perfectly
 * translated; something downstream just wins over it:
 *
 *   - CLOBBER:   a dynamic `contribution.updateCommand('<key>', { label / description /
 *                groupLabels })` that supplies a **literal** for a key the CATALOG already owns.
 *                The dynamic contribution is the most-specific layer in the cascade, so its inline
 *                English literal beats the localized catalog value and the command is pinned to
 *                English. (This is exactly how the file menu — New/Open/Save/Save As — silently
 *                stopped translating after the catalog migration.) → FAILS.
 *
 *                NOT flagged: an override whose text comes from `t(...)` / `messageKey(...)`.
 *                Overriding a less-specific scope's chrome IS the command cascade working as
 *                designed (the table structural ops must out-word the sheet keys they override);
 *                it only breaks localization when the value is frozen at authoring time. Prefer an
 *                ICU message + `params` in the catalog where the variation fits ICU; a dynamic
 *                `t()` is the sanctioned escape hatch where it does not. See {@link pinsEnglish}.
 *
 *   - MODULE-T:   a React file (`.tsx`) importing the module-level `t` from `@sheetxl/utils`.
 *                `t` reads a singleton, so React cannot know the value changed on a language
 *                switch — the component must ALSO subscribe, and forgetting is invisible (the
 *                string freezes at whatever language was active when it mounted; the Name Box
 *                tooltip shipped exactly that way, and one subscription sat in the wrong
 *                component entirely). `useTranslator()` returns a `t` bound to a subscription,
 *                making the two inseparable. The module export stays for NON-React callers.
 *                → FAILS.
 *
 *   - HARDCODED: a bespoke command button passing a literal `label="…"` / `tooltip="…"` prop.
 *                The prop wins over the resolved (catalog-backed) entry chrome, so the head of a
 *                popup/split button stays English. The pattern is to author the chrome on the
 *                registered ENTRY and read it back (`useCommandButtonEntry(key)`), or — for a
 *                text-as-icon — `<CommandButtonEntryLabel entryKey="…"/>`.
 *                → reported; FAILS only with `--strict-hardcoded` (dialogs/panels legitimately
 *                still carry literals; those go through call-site `t()` incrementally).
 *
 * Usage:
 *   node scripts/i18n-chrome-lint.mjs [--strict-hardcoded]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STRICT_HARDCODED = process.argv.includes('--strict-hardcoded');

/**
 * Literals that are intentionally NOT translated — brand/proper nouns. Keep this tiny and justified;
 * everything else belongs in a catalog or a `t()` call.
 */
const NEVER_TRANSLATED = new Set(['SheetXL']);

/**
 * Strip line + block comments so a COMMENTED-OUT prop is not reported as live code (the realistic
 * false positive: `// description="…"` left behind next to an active prop). Deliberately leaves
 * string contents alone by ignoring `//` that is preceded by `:` (protocol-relative URLs).
 */
function stripComments(src) {
  return src
    // Preserve the newline COUNT so reported line numbers still match the real file.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .split('\n')
    // `[^\r\n]*`, NOT `.*$` — these files are CRLF, and `.` excludes `\r`, so a `$`-anchored
    // pattern silently never matches on a `\r`-terminated line.
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/[^\r\n]*/, '$1'))
    .join('\n');
}

/**
 * Components whose `label`/`tooltip` props are NOT command chrome — plain MUI/exhibit controls
 * (form fields, dialog buttons, checkboxes). Only *command* buttons resolve through the registry.
 */
const COMMAND_BUTTON_TAGS = new Set([
  'CommandButton', 'CommandPopupButton', 'CommandGroup', 'CommandToolbar',
  'InputCommandButton', 'ToggleGroupButton', 'LabelIcon', 'ExhibitTooltip'
]);

/** Catalog keys → the text fields the catalog owns for each. */
function loadCatalogKeys() {
  const keys = new Map();
  const pkgsDir = path.join(ROOT, 'packages');
  for (const pkg of fs.readdirSync(pkgsDir)) {
    const enDir = path.join(pkgsDir, pkg, 'resources', 'locales', 'en');
    if (!fs.existsSync(enDir)) continue;
    for (const f of fs.readdirSync(enDir).filter((f) => f.endsWith('.cmd.json'))) {
      const cat = JSON.parse(fs.readFileSync(path.join(enDir, f), 'utf8'));
      for (const [k, rec] of Object.entries(cat.commands ?? {})) {
        keys.set(k, { file: `${pkg}/resources/locales/en/${f}`, fields: new Set(Object.keys(rec)) });
      }
    }
  }
  return keys;
}

function sourceFiles() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(node_modules|build|dist|__tests__)$/.test(e.name)) walk(p); }
      else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
    }
  })(path.join(ROOT, 'packages'));
  return out;
}

/** 1-indexed line of `idx` within `text`. */
const lineOf2 = (text, idx) => text.slice(0, idx).split('\n').length;

/**
 * Top-level properties of an object literal starting just after its `{`, as `name → value source`.
 * The VALUE matters, not just the name — see {@link pinsEnglish}.
 */
function topLevelFields(body) {
  const found = new Map();
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (depth === 0 && (i === 0 || /[\s,{]/.test(body[i - 1]))) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(i));
      if (m) {
        // Capture through to the next depth-0 comma (or the end) — the field's value expression.
        let j = i + m[0].length, d = 0;
        for (; j < body.length; j++) {
          const c = body[j];
          if (c === '{' || c === '(' || c === '[') d++;
          else if (c === '}' || c === ')' || c === ']') d--;
          else if (c === ',' && d === 0) break;
        }
        found.set(m[1], body.slice(i + m[0].length, j));
        i = j - 1;
      }
    }
  }
  return found;
}

const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/**
 * Does this chrome value **pin English** — i.e. does it carry display text that the catalog's
 * localized value can no longer reach?
 *
 * This is the actual defect CLOBBER exists to catch, and it is narrower than "the field is
 * present". A dynamic contribution re-authoring a field is the command framework working as
 * designed (a more specific scope overriding a less specific one — that IS the cascade). It only
 * breaks localization when the override supplies a **literal**, because a literal is frozen at
 * whatever language it was typed in. An override whose text comes from `t(...)` / `messageKey(...)`
 * re-resolves through the translator on every read, so it is localized exactly like the catalog
 * value it replaces — and is the sanctioned way to express chrome that varies at runtime in ways
 * ICU `params` cannot (e.g. the table structural ops, whose wording must beat the sheet key they
 * override).
 *
 * So: flag only when a string literal appears somewhere OTHER than as an argument to `t(` /
 * `messageKey(`, or as an object property key. A value with no literals at all (a bare identifier
 * or call) is given the same benefit of the doubt `i18n-extract.mjs` gives a non-literal key.
 */
function pinsEnglish(value) {
  let m;
  STRING_LITERAL.lastIndex = 0;
  while ((m = STRING_LITERAL.exec(value))) {
    const before = value.slice(0, m.index).trimEnd();
    if (/(?:^|[^\w$])(?:t|messageKey)\($/.test(before)) continue; // localized at read time
    const after = value.slice(m.index + m[0].length).trimStart();
    if (after.startsWith(':')) continue;                          // an object property key
    return true;
  }
  return false;
}

const CHROME_FIELDS = ['label', 'description', 'groupLabels'];

/**
 * STATIC-CHROME fields: not TEXT (nothing to translate), but they must still be **catalog**-authored
 * for a static command key, because two consumers read the STATIC REGISTRY rather than a mounted
 * command:
 *
 *  - the **shortcut palette** (`ShortcutKeysDialog`) seeds itself from the registry, so a `shortcut`
 *    contributed only in code does not appear there at all — the binding exists and is undiscoverable;
 *  - **`scripts/command-chord-lint.mjs`** reads the catalogs, so a code-only chord is invisible to the
 *    one-chord-one-command gate and can silently collide with a catalog binding.
 *
 * An `icon` is the same story for every pre-mount surface (the palette lists a blank glyph).
 */
const STATIC_CHROME_FIELDS = ['shortcut', 'icon'];

/**
 * Is this `icon`/`shortcut` value a CONSTANT the catalog could hold?
 *
 * `pinsEnglish` is the wrong test here: these fields carry no words, so "is there a literal" would
 * also condemn the values that legitimately cannot be authored — `s.isDark ? 'DarkMode' : 'LightMode'`
 * (state-driven), the per-write-format icon (chosen per dynamic command key). Those hold no single
 * answer to put in a JSON file. A branch (`?`) or a getter (`=>`) is exactly that signal, so require
 * a literal AND the absence of both: `'FileNew'` and `{ key: 'S', modifiers: [KeyModifiers.Ctrl] }`
 * qualify; anything computed is left alone.
 */
function isAuthorableChrome(value) {
  if (/\?|=>/.test(value)) return false;
  STRING_LITERAL.lastIndex = 0;
  return STRING_LITERAL.test(value);
}

/**
 * Contributions that override a catalog-owned `icon`/`shortcut` on purpose. Only a LAYER scope
 * belongs here: its node sits on the anchor chain even when its context is inactive, so a static
 * entry of its own would apply everywhere the key does — the very thing being avoided. Same
 * reasoning as the dynamic `t()` labels beside them.
 */
const STATIC_CHROME_ALLOW = new Map([
  ['packages/react/src/table/TableCommands.ts', 'Table layer scope OVERRIDES the sheet shift-cells icons while a table is selected; a static entry would re-icon the plain sheet command everywhere.']
]);

const catalog = loadCatalogKeys();
const clobber = [];
const staticChrome = [];
const hardcoded = [];
const moduleT = [];
const inlineEntry = [];

for (const file of sourceFiles()) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;

  // --- CLOBBER: updateCommand('<key>', { label|description|groupLabels: … })
  const uc = /updateCommand(?:<[^>]*>)?\(\s*['"`]([A-Za-z0-9_]+)['"`]\s*,\s*\{/g;
  let m;
  while ((m = uc.exec(src))) {
    const key = m[1];
    let i = uc.lastIndex, depth = 1;
    while (i < src.length && depth > 0) { const c = src[i]; if (c === '{') depth++; else if (c === '}') depth--; i++; }
    const top = topLevelFields(src.slice(uc.lastIndex, i - 1));
    const owned = catalog.get(key);
    if (!owned) continue;
    const offending = CHROME_FIELDS.filter(
      (f) => top.has(f) && owned.fields.has(f) && pinsEnglish(top.get(f))
    );
    if (offending.length) clobber.push({ rel, line: lineAt(m.index), key, fields: offending, cat: owned.file });

    // --- STATIC-CHROME: a LITERAL icon/shortcut on a static (literal-keyed) command. Unlike CLOBBER
    // this does not care whether the catalog already carries the field — the point is that the
    // catalog is where it must be AUTHORED, so an addition is flagged just like an override. A
    // computed value (`s.isDark ? 'DarkMode' : 'LightMode'`, a per-format icon) is genuinely dynamic
    // and passes, the way a `t()` label passes CLOBBER — see {@link isAuthorableChrome}.
    if (!STATIC_CHROME_ALLOW.has(rel)) {
      const statics = STATIC_CHROME_FIELDS.filter((f) => top.has(f) && isAuthorableChrome(top.get(f)));
      if (statics.length) staticChrome.push({ rel, line: lineAt(m.index), key, fields: statics, cat: owned.file });
    }
  }

  // --- HARDCODED / MODULE-T / INLINE-ENTRY operate on comment-stripped source.
  const code = stripComments(src);

  // --- INLINE-ENTRY: a registered command-button entry authoring a literal getLabel/getDescription.
  // The catalog is the source of truth for English too, so this is duplication that silently
  // out-ranks nothing but rots (the catalog can change and the literal will not).
  {
    const reg = /DefaultCommandButtonRegistry\.register\(\s*\{/g;
    let rm;
    while ((rm = reg.exec(code))) {
      let i = reg.lastIndex, depth = 1;
      while (i < code.length && depth > 0) { const c = code[i]; if (c === '{') depth++; else if (c === '}') depth--; i++; }
      const body = code.slice(reg.lastIndex, i - 1);
      const km = /\bkey\s*:\s*['"`]([^'"`]+)['"`]/.exec(body);
      let d = 0;
      for (let j = 0; j < body.length; j++) {
        const ch = body[j];
        if (ch === '{' || ch === '[' || ch === '(') d++;
        else if (ch === '}' || ch === ']' || ch === ')') d--;
        else if (d === 0) {
          // Only TOP-LEVEL getters with a STRING-LITERAL body (a JSX/function getter is behavior).
          const g = /^get(Label|Description)\s*:\s*\(\s*\)\s*=>\s*(['"`])((?:\\.|(?!\2).)*)\2/.exec(body.slice(j));
          if (g) {
            inlineEntry.push({ rel, line: lineOf2(code, reg.lastIndex + j), key: km?.[1] ?? '?', prop: `get${g[1]}`, text: g[3] });
            j += g[0].length - 1;
          }
        }
      }
    }
  }

  // --- MODULE-T: a .tsx importing the bare `t` from @sheetxl/utils. React can't see a singleton
  // change, so the component must separately subscribe — use `useTranslator()` instead.
  if (file.endsWith('.tsx')) {
    const imp = /import\s*\{([^}]*)\}\s*from\s*['"]@sheetxl\/utils['"]/g;
    let im;
    while ((im = imp.exec(code))) {
      const named = im[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
      if (named.includes('t')) moduleT.push({ rel, line: lineOf2(code, im.index) });
    }
  }

  const lineOf = (idx) => code.slice(0, idx).split('\n').length; // comment-stripping preserves lines
  const tag = /<([A-Z][\w]*)\b([^>]*?)\/?>/gs;
  while ((m = tag.exec(code))) {
    if (!COMMAND_BUTTON_TAGS.has(m[1])) continue;
    for (const prop of ['label', 'tooltip', 'description']) {
      const pm = new RegExp(`\\b${prop}=\\{?["'\`]([^"'\`]{2,})["'\`]\\}?`).exec(m[2]);
      if (pm && !NEVER_TRANSLATED.has(pm[1])) {
        hardcoded.push({ rel, line: lineOf(m.index), tag: m[1], prop, text: pm[1] });
      }
    }
  }
}

let failed = false;

if (clobber.length) {
  failed = true;
  console.error(`\nCLOBBER (${clobber.length}) — dynamic contribution supplies a LITERAL for chrome the CATALOG owns (pins it to English):`);
  for (const c of clobber) {
    console.error(`  ${c.rel}:${c.line}  ${c.key} [${c.fields.join(', ')}]  — owned by ${c.cat}`);
  }
  console.error(`\n  Fix: delete the field(s) from the dynamic contribution and let the catalog answer. If the`);
  console.error(`  text varies at runtime, author it in the catalog as an ICU message + \`params\`; where the`);
  console.error(`  variation does not fit ICU, resolve it with \`t(...)\`/\`messageKey(...)\` — overriding is`);
  console.error(`  fine, freezing the words at authoring time is not.`);
} else {
  console.log('✓ no dynamic contribution clobbers catalog-owned chrome');
}

if (staticChrome.length) {
  failed = true;
  console.error(`\nSTATIC-CHROME (${staticChrome.length}) — constant icon/shortcut contributed in CODE for a static command key:`);
  for (const c of staticChrome) {
    console.error(`  ${c.rel}:${c.line}  ${c.key} [${c.fields.join(', ')}]  — catalog: ${c.cat}`);
  }
  console.error(`\n  Fix: author it in the catalog next to the label. A code-only \`shortcut\` never reaches the`);
  console.error(`  shortcut palette (it seeds from the static registry) and is invisible to`);
  console.error(`  scripts/command-chord-lint.mjs, so it can collide unnoticed; a code-only \`icon\` leaves every`);
  console.error(`  pre-mount surface blank. Gating registration on a capability is NOT a reason to keep it here:`);
  console.error(`  chrome with no callback resolves disabled, and \`dispatch\` passes a disabled binding through.`);
} else {
  console.log('✓ no code-authored static icon/shortcut on catalog-owned commands');
}

if (hardcoded.length) {
  console[STRICT_HARDCODED ? 'error' : 'warn'](
    `\nHARDCODED (${hardcoded.length}) — literal chrome prop on a command component (wins over resolved entry chrome):`);
  for (const h of hardcoded) console.warn(`  ${h.rel}:${h.line}  <${h.tag} ${h.prop}="${h.text}">`);
  console.warn(`\n  Fix: author the chrome on the registered ENTRY and read it back —`);
  console.warn(`  \`useCommandButtonEntry('<key>')\`, or <CommandButtonEntryLabel entryKey="<key>"/> for text-as-icon.`);
  if (STRICT_HARDCODED) failed = true;
} else {
  console.log('✓ no hardcoded chrome props on command components');
}

if (inlineEntry.length) {
  failed = true;
  console.error(`\nINLINE-ENTRY (${inlineEntry.length}) — registered entry authors literal chrome the CATALOG owns:`);
  for (const e of inlineEntry) console.error(`  ${e.rel}:${e.line}  ${e.key}.${e.prop} = ${JSON.stringify(e.text)}`);
  console.error(`\n  Fix: delete the getter — the entry needs only its \`key\`. Put the English in the`);
  console.error(`  catalog next to the other languages; \`translateEntry\` synthesizes the getter from it.`);
} else {
  console.log('✓ no registered entry authors literal chrome');
}

if (moduleT.length) {
  failed = true;
  console.error(`\nMODULE-T (${moduleT.length}) — React file imports the module-level \`t\` (no language subscription):`);
  for (const u of moduleT) console.error(`  ${u.rel}:${u.line}`);
  console.error(`\n  Fix: \`const t = useTranslator();\` inside the component that renders the string.`);
  console.error(`  The module \`t\` is for NON-React callers; in a component it silently freezes the`);
  console.error(`  string at mount-time language unless that component also subscribes.`);
} else {
  console.log('✓ no React file imports the module-level t');
}

process.exit(failed ? 1 : 0);
