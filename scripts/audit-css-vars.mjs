#!/usr/bin/env node
/**
 * audit-css-vars.mjs — Phase 0 of the Theming Cleanup Plan.
 *
 * Statically scans the monorepo for `--sxl-*` CSS custom properties and reports the
 * two failure modes that the theming refactor keeps hitting:
 *
 *   1. CONSUMED-BUT-NEVER-DEFINED — `var(--sxl-foo)` where nothing ever assigns
 *      `--sxl-foo:`. This is the silent dead-var bug class (a rename / typo that
 *      falls through to a fallback literal). This is an ERROR — the script exits 1.
 *   2. DEFINED-BUT-NEVER-CONSUMED — a token is assigned but no `var()` reads it.
 *      Usually harmless (public API tokens, WIP) so it is a WARNING only.
 *
 * Definitions are detected in four shapes:
 *   - CSS declarations:            `--sxl-foo: red;`
 *   - Quoted TS/JS object keys:    `'--sxl-foo': value`  (inline style objects)
 *   - Computed object keys:        `['--sxl-foo' as any]: value`
 *   - element.style.setProperty(): `setProperty('--sxl-foo', value)`
 * Consumptions are `var(--sxl-foo)` (with or without a fallback).
 *
 * A consumed-but-undefined token is an ERROR only when at least one consumption has
 * NO fallback (`var(--sxl-foo)`) — that site renders as an invalid/inherited value
 * (the white eval-tip bug class). When every consumption supplies a fallback
 * (`var(--sxl-foo, #fff)`) the token degrades gracefully; it is reported as a
 * WARNING to clean up but does not fail the gate.
 *
 * Blind spots (reported, not failed on): names built by template interpolation
 * (`--sxl-sys-color-${name}`) cannot be resolved statically. Tokens in those name-spaces
 * are treated as externally/dynamically provided and excluded from the error set.
 *
 * It also guards the theme contract (THEMING-DESIGN §1, §3):
 *
 *   3. UNKNOWN TOKEN — a read in a token name-space (`--sxl-color-*`, `font-*`, `radius-*`, …) that names no
 *      `TokenTheme` key. ERROR.
 *   4. SURFACE WITHOUT MODE — a JSX element or attribute object that sets `data-sxl-theme-surface` but not
 *      `data-sxl-theme-mode`. The theme rules match on both, so a surface alone draws the light cell. ERROR.
 *   5. OFF CONTRACT — a `--sxl-*` name that is not a token, `doc-*` or `sys-color-*`, or a custom property
 *      outside `--sxl-*` / `--_sxl-*` (the private namespace). WARNING until the component-variable pass.
 *
 * Usage:  node scripts/audit-css-vars.mjs [--json] [--quiet]
 * Exit:   0 = clean, 1 = a dead fallback-less var, an unknown token, or a surface without a mode.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['packages', 'examples'];
const EXTS = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', 'storybook-static', '.turbo']);

/**
 * Name-spaces whose tokens are legitimately defined outside this repo (a host maps
 * onto them) OR only constructed via template interpolation. Consumed-but-undefined
 * tokens under these prefixes are informational, never errors.
 *   --sxl-sys-color-*   : the external system-color contract (VSCode `--vscode-*` maps here).
 *   --sxl-doc-*   : document-theme tokens injected per-workbook from the file.
 *   --sxl-color-* / --sxl-font-* / --sxl-radius-* / --sxl-border / --sxl-image-* : the theme tokens produced
 *     by the generator (utils-react `themeVars`/`buildThemeCSS`) from the flat `Tokens` type — the static scan
 *     can't see those (names are built as `--sxl-${key}`). The `Tokens` interface is the typo-guard for
 *     typed callers; restoring CSS-string typo detection here needs a static token registry (follow-up).
 */
const EXTERNAL_PREFIXES = ['--sxl-sys-color-', '--sxl-doc-', '--sxl-color-', '--sxl-font-', '--sxl-radius-', '--sxl-border', '--sxl-image-'];

/**
 * Dead prototypes — unexported, unimported, and scheduled for deletion in Phase 2 of
 * the Theming Cleanup Plan. Their internal (also-broken) vars are noise; skip them.
 */
const IGNORE_FILES = new Set([
]);

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const quiet = args.has('--quiet');

const NAME = '--sxl-[a-z0-9-]+';
// capture the name AND the delimiter after it: ')' = no fallback, ',' = has fallback
const RE_USE = new RegExp(`var\\(\\s*(${NAME})\\s*([),])`, 'g');
// name immediately followed by an optional closing quote then ':' (CSS decl or object key)
const RE_DEF = new RegExp(`(${NAME})['"\`]?\\s*:`, 'g');
// computed object key, incl. TS cast: ['--sxl-foo' as any]: value
const RE_DEF_COMPUTED = new RegExp(`\\[\\s*['"\`](${NAME})['"\`][^\\]\\n]*\\]\\s*:`, 'g');
const RE_DEF_SETPROP = new RegExp(`setProperty\\(\\s*['"\`](${NAME})`, 'g');
// a name whose next char starts a template hole -> dynamic, unresolvable
const RE_DYNAMIC = new RegExp(`--sxl-[a-z0-9-]*\\$\\{`, 'g');

/**
 * The theme contract (THEMING-DESIGN §1): the `--sxl-*` names a client may read or set. Every `TokenTheme` key,
 * with a list token expanded to its numbered vars (`color-series` -> `--sxl-color-series-1..N`). Read from
 * the source so a new key needs no edit here.
 */
function loadTokenRegistry() {
  const themeDir = join(ROOT, 'packages/utils-react/src/theme');
  const tokenSrc = readFileSync(join(themeDir, 'TokenTheme.ts'), 'utf8');
  const defaultsSrc = readFileSync(join(themeDir, 'defaultTheme.ts'), 'utf8');
  const body = tokenSrc.slice(tokenSrc.indexOf('export interface TokenTheme'));
  const counts = {
    'color-series': Number(/SERIES_COUNT\s*=\s*(\d+)/.exec(defaultsSrc)?.[1]),
    'color-bracket': Number(/BRACKET_COUNT\s*=\s*(\d+)/.exec(defaultsSrc)?.[1])
  };
  const names = new Set();
  const re = /^\s*'([a-z0-9-]+)'\??\s*:\s*([^;]+);/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const [, key, type] = m;
    if (type.trim().endsWith('[]')) {
      const n = counts[key];
      if (!n) throw new Error(`audit-css-vars: list token '${key}' has no count constant`);
      for (let i = 1; i <= n; i++) names.add(`--sxl-${key}-${i}`);
    } else {
      names.add(`--sxl-${key}`);
    }
  }
  if (names.size < 20) throw new Error(`audit-css-vars: parsed only ${names.size} tokens from TokenTheme.ts`);
  return names;
}
const TOKENS = loadTokenRegistry();
/** Name-spaces that belong to the token contract: a read here must be a real `TokenTheme` key. */
const TOKEN_PREFIXES = ['--sxl-color-', '--sxl-font-', '--sxl-radius-', '--sxl-border', '--sxl-image-', '--sxl-z-'];
const isTokenNamespace = (t) => TOKEN_PREFIXES.some((p) => t.startsWith(p));
/** Public, non-token name-spaces: document colors and fonts, and the system-color aliases. */
const isDocOrSystem = (t) => t.startsWith('--sxl-doc-') || t.startsWith('--sxl-sys-color-');

/** Any custom property defined (CSS declaration or a quoted style key), for the naming check. */
const RE_ANY_DEF = /(?<![\w-])(--[a-zA-Z_][\w-]*)['"`]?\s*:/g;
/** A JSX attribute or object key that sets the theme surface. */
const RE_SURFACE_ATTR = /(?<!\[)['"]?data-sxl-theme-surface['"]?\s*[=:]/g;

/** token -> Set("relPath:line") */
const defs = new Map();
/** custom properties outside `--sxl-*` / `--_sxl-*` -> Set("relPath:line") */
const offNamespace = new Map();
/** "relPath:line" of a surface attribute with no mode on the same element */
const surfaceWithoutMode = [];
const uses = new Map();
/** tokens with at least one fallback-less consumption (`var(--x)`) */
const noFallback = new Set();
const dynamicFiles = new Set();

function addLoc(map, token, loc) {
  let s = map.get(token);
  if (!s) map.set(token, (s = new Set()));
  s.add(loc);
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/**
 * Blank out `/* *\/` and `//` comments (and their content) so doc examples / commented-out code don't
 * count as real definitions or consumptions. Replaces comment chars with spaces (keeping newlines) so
 * reported line numbers stay accurate. Heuristic — good enough for a lint helper.
 */
function blankComments(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  text = text.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  return text;
}

/** End of the JSX opening tag that starts at `start` (`<Tag`), skipping `{…}` expressions and strings. */
function tagEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

/** End of the `{…}` that opens at `start`. */
function braceEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * The element (a JSX opening tag, or an object literal of attributes) that sets the surface at `index`, or
 * null when it cannot be found. Design §3: an adopter always states its mode beside its surface, since the
 * theme rules match on both and a surface alone falls back to the light cell.
 */
function surfaceElement(text, index, isJsx) {
  if (isJsx) {
    for (let i = index; i >= 0; i--) {
      if (text[i] === '<' && /[A-Za-z]/.test(text[i + 1] ?? '')) {
        const end = tagEnd(text, i);
        return end > index ? text.slice(i, end + 1) : null;
      }
    }
    return null;
  }
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    if (text[i] === '}') depth++;
    else if (text[i] === '{' && depth-- === 0) {
      const end = braceEnd(text, i);
      return end > index ? text.slice(i, end + 1) : null;
    }
  }
  return null;
}

function scanFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join('/');
  if (IGNORE_FILES.has(rel)) return;
  const text = blankComments(readFileSync(absPath, 'utf8'));

  for (const [map, re] of [[defs, RE_DEF], [defs, RE_DEF_COMPUTED], [defs, RE_DEF_SETPROP]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const token = m[1];
      if (token.endsWith('-')) continue; // trailing hyphen => template prefix, skip
      addLoc(map, token, `${rel}:${lineOf(text, m.index)}`);
    }
  }
  RE_USE.lastIndex = 0;
  let u;
  while ((u = RE_USE.exec(text)) !== null) {
    const token = u[1];
    if (token.endsWith('-')) continue;
    addLoc(uses, token, `${rel}:${lineOf(text, u.index)}`);
    if (u[2] === ')') noFallback.add(token); // var(--x) with no fallback
  }
  if (RE_DYNAMIC.test(text)) dynamicFiles.add(rel);
  RE_DYNAMIC.lastIndex = 0;

  RE_ANY_DEF.lastIndex = 0;
  let d;
  while ((d = RE_ANY_DEF.exec(text)) !== null) {
    const name = d[1];
    if (name.startsWith('--sxl-') || name.startsWith('--_sxl-') || name.endsWith('-')) continue;
    addLoc(offNamespace, name, `${rel}:${lineOf(text, d.index)}`);
  }

  if (/\.[jt]sx$/.test(rel)) {
    RE_SURFACE_ATTR.lastIndex = 0;
    let s;
    while ((s = RE_SURFACE_ATTR.exec(text)) !== null) {
      const isJsx = s[0].trimEnd().endsWith('=');
      const element = surfaceElement(text, s.index, isJsx);
      if (!element || !/data-sxl-theme-mode/.test(element)) {
        surfaceWithoutMode.push(`${rel}:${lineOf(text, s.index)}`);
      }
    }
  }
}

function walk(absDir) {
  for (const entry of readdirSync(absDir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs);
    else if (EXTS.has(entry.slice(entry.lastIndexOf('.')))) scanFile(abs);
  }
}

for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  try { if (statSync(abs).isDirectory()) walk(abs); } catch { /* dir absent */ }
}

const isExternal = (t) => EXTERNAL_PREFIXES.some((p) => t.startsWith(p));

const consumedUndefined = [...uses.keys()].filter((t) => !defs.has(t) && !isExternal(t));
// ERROR: at least one fallback-less consumption -> renders broken. WARN: always has a fallback.
const deadErrors = consumedUndefined.filter((t) => noFallback.has(t)).sort();
const deadWarnings = consumedUndefined.filter((t) => !noFallback.has(t)).sort();
const definedUnconsumed = [...defs.keys()]
  .filter((t) => !uses.has(t))
  .sort();
const externalConsumed = [...uses.keys()]
  .filter((t) => !defs.has(t) && isExternal(t))
  .sort();
// ERROR: a read in a token name-space that names no `TokenTheme` key (a typo, or a removed token).
const unknownTokens = [...uses.keys()].filter((t) => isTokenNamespace(t) && !TOKENS.has(t)).sort();
// WARN until the component-variable pass lands: `--sxl-*` names outside the contract (use-case variables
// and component plumbing), and custom properties outside `--sxl-*` / `--_sxl-*`.
const offContract = [...new Set([...uses.keys(), ...defs.keys()])]
  .filter((t) => !isTokenNamespace(t) && !isDocOrSystem(t))
  .sort();
const offNamespaceNames = [...offNamespace.keys()].sort();

if (asJson) {
  console.log(JSON.stringify({
    deadErrors: deadErrors.map((t) => ({ token: t, usedAt: [...uses.get(t)] })),
    deadWarnings: deadWarnings.map((t) => ({ token: t, usedAt: [...uses.get(t)] })),
    definedUnconsumed: definedUnconsumed.map((t) => ({ token: t, definedAt: [...defs.get(t)] })),
    externalConsumed,
    unknownTokens: unknownTokens.map((t) => ({ token: t, usedAt: [...uses.get(t)] })),
    surfaceWithoutMode,
    offContract,
    offNamespace: offNamespaceNames.map((t) => ({ name: t, definedAt: [...offNamespace.get(t)] })),
    dynamicFiles: [...dynamicFiles],
  }, null, 2));
} else if (!quiet) {
  const c = { red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m' };
  console.log(`${c.bold}CSS var audit${c.reset}  (defined: ${defs.size}, consumed: ${uses.size})\n`);

  if (deadErrors.length) {
    console.log(`${c.red}${c.bold}✗ consumed, undefined, NO fallback — renders broken (${deadErrors.length}):${c.reset}`);
    for (const t of deadErrors) {
      console.log(`  ${c.red}${t}${c.reset}`);
      for (const loc of uses.get(t)) console.log(`    ${c.dim}${loc}${c.reset}`);
    }
    console.log('');
  } else {
    console.log(`${c.bold}✓ no fallback-less dead vars${c.reset}\n`);
  }

  if (deadWarnings.length) {
    console.log(`${c.yellow}⚠ consumed, undefined, but has fallback — clean up (${deadWarnings.length}):${c.reset}`);
    for (const t of deadWarnings) {
      console.log(`  ${c.yellow}${t}${c.reset} ${c.dim}(${[...uses.get(t)][0]})${c.reset}`);
    }
    console.log('');
  }

  if (unknownTokens.length) {
    console.log(`${c.red}${c.bold}✗ token reads that name no TokenTheme key (${unknownTokens.length}):${c.reset}`);
    for (const t of unknownTokens) {
      console.log(`  ${c.red}${t}${c.reset}`);
      for (const loc of uses.get(t)) console.log(`    ${c.dim}${loc}${c.reset}`);
    }
    console.log('');
  } else {
    console.log(`${c.bold}✓ every token read names a TokenTheme key${c.reset}
`);
  }

  if (surfaceWithoutMode.length) {
    console.log(`${c.red}${c.bold}✗ data-sxl-theme-surface with no data-sxl-theme-mode beside it (${surfaceWithoutMode.length}):${c.reset}`);
    for (const loc of surfaceWithoutMode) console.log(`  ${c.red}${loc}${c.reset}`);
    console.log('');
  } else {
    console.log(`${c.bold}✓ every surface attribute carries a mode${c.reset}
`);
  }

  if (offContract.length) {
    console.log(`${c.yellow}⚠ --sxl-* names outside the theme contract (${offContract.length}): ${offContract.join(', ')}${c.reset}
`);
  }
  if (offNamespaceNames.length) {
    console.log(`${c.yellow}⚠ custom properties outside --sxl-* / --_sxl-* (${offNamespaceNames.length}): ${offNamespaceNames.join(', ')}${c.reset}
`);
  }

  if (definedUnconsumed.length) {
    console.log(`${c.dim}ℹ defined but never consumed (${definedUnconsumed.length}): ${definedUnconsumed.join(', ')}${c.reset}`);
  }
  if (externalConsumed.length) {
    console.log(`${c.dim}ℹ external contract tokens consumed (ok): ${externalConsumed.length}${c.reset}`);
  }
  if (dynamicFiles.size) {
    console.log(`${c.dim}ℹ files with template-built var names (blind spot): ${[...dynamicFiles].join(', ')}${c.reset}`);
  }
}

// Gate on what renders broken: fallback-less dead vars, token typos, and a surface with no mode.
process.exit(deadErrors.length || unknownTokens.length || surfaceWithoutMode.length ? 1 : 0);
