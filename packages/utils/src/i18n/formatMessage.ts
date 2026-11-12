import { type LanguageTag } from './Types';

/**
 * A minimal **ICU MessageFormat subset** evaluator (I18N-DESIGN.md open-Q6 / Phase 7).
 *
 * Messages are authored in real ICU syntax so `@formatjs/intl-messageformat` (or
 * `@lingui/core`) can drop in behind {@link ITranslator} later without re-authoring
 * a single catalog string. Supported subset:
 *
 * - `{name}` — simple argument. An unknown/missing param is left literal (`{name}`),
 *   matching `interpolate` — visible and debuggable, never a throw.
 * - `{count, plural, offset:1 =0{none} one{# item} other{# items}}` — cardinal plurals
 *   via `Intl.PluralRules(language)`. `=N` exact matches win over categories
 *   (`zero|one|two|few|many|other`); `#` renders the offset-subtracted number via
 *   `Intl.NumberFormat(language)`. Missing/non-numeric value → the `other` branch.
 * - `{place, selectordinal, one{#st} two{#nd} few{#rd} other{#th}}` — ordinal plurals.
 * - `{kind, select, row{Row} column{Column} other{Range}}` — value selection.
 * - Branches nest arbitrarily (`{n, plural, other{{name} has # items}}`); `#` inside a
 *   nested `select` still refers to the nearest enclosing plural's value.
 * - ICU apostrophe quoting: `''` is a literal apostrophe; `'` immediately before a
 *   syntax character (`{`, `}`, or `#` inside a plural branch) quotes literal text
 *   until the next `'`. A lone apostrophe elsewhere (`Can't Undo`) is literal.
 *
 * NOT supported (out of subset — the drop-in library owns them if ever needed):
 * `number`/`date`/`time` argument types (treated as a simple argument), nested rich
 * tags. Malformed messages degrade best-effort to literal text — a label must never
 * throw at render time.
 */

/** A parsed message segment. Literal text is stored as a plain string. */
type Part =
  | string
  | { kind: 'arg'; name: string }
  | { kind: 'hash' }
  | { kind: 'branched'; type: 'plural' | 'selectordinal' | 'select'; name: string; offset: number;
      branches: Record<string, Part[]> };

const isWs = (ch: string): boolean => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

/** Mutable scan position, shared across the recursive descent. */
interface Pos { i: number }

function skipWs(src: string, pos: Pos): void {
  while (pos.i < src.length && isWs(src[pos.i])) pos.i++;
}

/**
 * Parse until end-of-string or an unbalanced `}` (branch close). `inPlural` marks whether
 * `#` is syntax here (directly or transitively — through `select` — inside a plural branch).
 */
function parseParts(src: string, pos: Pos, inPlural: boolean, depth: number): Part[] {
  const parts: Part[] = [];
  let text = '';
  const flush = (): void => { if (text) { parts.push(text); text = ''; } };
  while (pos.i < src.length) {
    const ch = src[pos.i];
    if (ch === '}' && depth > 0) break; // branch close — caller consumes it
    if (ch === '{') {
      pos.i++;
      flush();
      parts.push(parseArg(src, pos, inPlural, depth));
      continue;
    }
    if (ch === '#' && inPlural) {
      flush();
      parts.push({ kind: 'hash' });
      pos.i++;
      continue;
    }
    if (ch === "'") {
      const next = src[pos.i + 1];
      if (next === "'") { text += "'"; pos.i += 2; continue; }
      if (next === '{' || next === '}' || (next === '#' && inPlural)) {
        pos.i++; // opening quote — literal run until the closing apostrophe
        while (pos.i < src.length) {
          const q = src[pos.i];
          if (q === "'") {
            if (src[pos.i + 1] === "'") { text += "'"; pos.i += 2; continue; }
            pos.i++;
            break;
          }
          text += q;
          pos.i++;
        }
        continue;
      }
      text += "'"; // lone apostrophe is literal (Can't Undo)
      pos.i++;
      continue;
    }
    text += ch;
    pos.i++;
  }
  flush();
  return parts;
}

/** Parse one `{…}` argument; `pos` sits just past the `{`. Consumes the closing `}`. */
function parseArg(src: string, pos: Pos, inPlural: boolean, depth: number): Part {
  const nameStart = pos.i;
  while (pos.i < src.length && src[pos.i] !== ',' && src[pos.i] !== '}') pos.i++;
  const name = src.slice(nameStart, pos.i).trim();
  if (src[pos.i] === '}') { pos.i++; return { kind: 'arg', name }; }
  if (pos.i >= src.length) return { kind: 'arg', name }; // malformed: unterminated
  pos.i++; // ','

  const typeStart = pos.i;
  while (pos.i < src.length && src[pos.i] !== ',' && src[pos.i] !== '}') pos.i++;
  const type = src.slice(typeStart, pos.i).trim();
  const branched = type === 'plural' || type === 'selectordinal' || type === 'select';
  if (src[pos.i] !== ',' || !branched) {
    // `{name}` with stray comma, `{value, number}` (out of subset), or malformed —
    // degrade to a simple argument; skip the rest of this argument's balanced braces.
    let level = depth + 1;
    while (pos.i < src.length && level > depth) {
      if (src[pos.i] === '{') level++;
      else if (src[pos.i] === '}') level--;
      pos.i++;
    }
    return { kind: 'arg', name };
  }
  pos.i++; // ',' before the options

  const branches: Record<string, Part[]> = {};
  let offset = 0;
  for (;;) {
    skipWs(src, pos);
    if (pos.i >= src.length) break; // malformed: unterminated — use what we have
    if (src[pos.i] === '}') { pos.i++; break; }
    const selStart = pos.i;
    while (pos.i < src.length && src[pos.i] !== '{' && src[pos.i] !== '}' && !isWs(src[pos.i])) pos.i++;
    const selector = src.slice(selStart, pos.i);
    if (selector.startsWith('offset:')) {
      offset = parseInt(selector.slice(7), 10) || 0;
      continue;
    }
    skipWs(src, pos);
    if (src[pos.i] !== '{') break; // malformed selector — stop parsing options
    pos.i++;
    // `#` stays live through nested `select` branches; a nested plural rebinds it anyway.
    const branchPlural = type === 'select' ? inPlural : true;
    branches[selector] = parseParts(src, pos, branchPlural, depth + 1);
    if (src[pos.i] === '}') pos.i++; // branch close
  }
  return { kind: 'branched', type, name, offset, branches };
}

// Per-language Intl caches (language sets are tiny; entries are cheap).
const _cardinalRules = new Map<string, Intl.PluralRules>();
const _ordinalRules = new Map<string, Intl.PluralRules>();
const _numberFormats = new Map<string, Intl.NumberFormat>();

function _pluralRules(language: string, ordinal: boolean): Intl.PluralRules {
  const cache = ordinal ? _ordinalRules : _cardinalRules;
  let rules = cache.get(language);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(language, ordinal ? { type: 'ordinal' } : undefined);
    } catch {
      rules = new Intl.PluralRules('en', ordinal ? { type: 'ordinal' } : undefined);
    }
    cache.set(language, rules);
  }
  return rules;
}

function _numberFormat(language: string): Intl.NumberFormat {
  let fmt = _numberFormats.get(language);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(language);
    } catch {
      fmt = new Intl.NumberFormat('en');
    }
    _numberFormats.set(language, fmt);
  }
  return fmt;
}

/** Evaluate parsed parts. `hashValue` is the nearest enclosing plural's offset number. */
function _evalParts(
  parts: Part[],
  params: Record<string, unknown> | undefined,
  language: string,
  hashValue: number | undefined
): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') { out += part; continue; }
    if (part.kind === 'arg') {
      const value = params?.[part.name];
      out += value === undefined ? `{${part.name}}` : String(value);
      continue;
    }
    if (part.kind === 'hash') {
      out += hashValue === undefined ? '#' : _numberFormat(language).format(hashValue);
      continue;
    }
    // branched: plural / selectordinal / select
    const value = params?.[part.name];
    if (part.type === 'select') {
      const branch = (value !== undefined ? part.branches[String(value)] : undefined) ?? part.branches['other'];
      out += branch
        ? _evalParts(branch, params, language, hashValue)
        : (value === undefined ? `{${part.name}}` : String(value));
      continue;
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (value === undefined || Number.isNaN(num)) {
      const branch = part.branches['other'];
      out += branch ? _evalParts(branch, params, language, undefined) : `{${part.name}}`;
      continue;
    }
    let branch = part.branches[`=${num}`];
    const offsetNum = num - part.offset;
    if (!branch) {
      const category = _pluralRules(language, part.type === 'selectordinal').select(offsetNum);
      branch = part.branches[category] ?? part.branches['other'];
    }
    out += branch ? _evalParts(branch, params, language, offsetNum) : String(value);
  }
  return out;
}

// Parsed-message cache. Catalogs are finite so this converges; the cap only guards a
// pathological unbounded-message-source (cleared wholesale — no LRU bookkeeping).
const _parseCache = new Map<string, Part[]>();
const PARSE_CACHE_MAX = 4000;

/**
 * Format an ICU-subset `message` with `params`, using `language` for plural category
 * selection and `#` number rendering (see the module doc for the exact subset).
 *
 * This is the single formatting path behind {@link ITranslator.t}/`lookup` — pack
 * messages format with the active language, the English call-site fallback with `'en'`.
 * Plain `{name}` messages behave exactly like `interpolate`.
 */
export function formatMessage(
  message: string,
  params?: Record<string, unknown>,
  language: LanguageTag = 'en'
): string {
  // Fast path: no arguments and no escaped apostrophes — nothing to evaluate.
  if (message.indexOf('{') < 0 && message.indexOf("''") < 0) return message;
  let parts = _parseCache.get(message);
  if (!parts) {
    if (_parseCache.size >= PARSE_CACHE_MAX) _parseCache.clear();
    parts = parseParts(message, { i: 0 }, false, 0);
    _parseCache.set(message, parts);
  }
  return _evalParts(parts, params, language, undefined);
}
