/**
 * Command **chord** lint — one physical keystroke must map to one command.
 *
 *   node scripts/command-chord-lint.mjs           # report
 *   node scripts/command-chord-lint.mjs --check   # non-zero on unallowed collisions (CI)
 *
 * **Why this can't be an exact string compare.** A shortcut is authored as a string
 * (`'ctrl+shift+Backquote'`), but `KeyBindingDispatcher` matches an event against BOTH canonical
 * forms it can produce — one from `e.code`, one from `e.key` (see `keyEventCanonicals`). So
 * `'alt+Semicolon'` and `'alt+;'` are the SAME physical chord while being different strings, and
 * two commands can claim it without any string-level duplicate to notice. That is not benign:
 * `dispatch` takes the FIRST key `collectKeys()` yields, and if that one resolves disabled it
 * returns `false` WITHOUT falling through to the other — so the loser is dead and the winner
 * depends on scope-walk order. This lint folds both spellings onto one physical id and compares.
 *
 * **What is NOT a collision.** A contextual scope deliberately re-binding an ancestor's chord is
 * the override mechanism working (`editor` takes F4 for relative-references only while a formula
 * is being edited; `sheet` keeps it for redo otherwise). Those are legal *because both sides carry
 * behavior* — the loser still runs when the winner isn't anchored. They live in `ALLOWED` below
 * with the reason spelled out; an entry that stops colliding is reported so the list can't rot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

/**
 * Intentional cross-scope re-binds: `'scopeA:keyA|scopeB:keyB'` (the two sides sorted) → why.
 * Only add one when BOTH commands have behavior and the scopes are not simultaneously anchored (or
 * the deeper one legitimately wins while its context is active).
 */
const ALLOWED = new Map([
  ['app:help|scriptEditor:showScriptingCommands',
    'scriptEditor is a separate region with its own resolver — its bindings win only while the script editor is focused.'],
  ['editor:relativeReferencesToggle|sheet:redo',
    'Excel parity: F4 toggles reference style while editing a formula (editor scope anchored), and repeats/redoes otherwise.'],
  ['movable:moveBackward|workbook:selectDirectPrecedents',
    'movable is a layer scope contributed only while a drawing object is active; the workbook binding applies otherwise.'],
  ['movable:moveForward|workbook:selectDirectDependents',
    'movable is a layer scope contributed only while a drawing object is active; the workbook binding applies otherwise.'],
  ['movable:moveToBack|workbook:selectPrecedents',
    'movable is a layer scope contributed only while a drawing object is active; the workbook binding applies otherwise.'],
  ['movable:moveToFront|workbook:selectDependents',
    'movable is a layer scope contributed only while a drawing object is active; the workbook binding applies otherwise.']
]);

/**
 * The `movable` layer's KEYBOARD ops (nudge / size / delete / select-all / Tab) re-bind the grid's own
 * arrow, Delete, Ctrl+A and Tab chords. Same reason as the arrange entries above — the scope is contributed only
 * while a drawing is selected, so the grid binding applies otherwise — but one pair per chord, which is
 * a table rather than sixteen near-identical lines. Rotate (`alt+Arrow*`) claims a free chord and needs
 * no entry.
 */
const MOVABLE_KEYBOARD_REASON =
  'movable is a layer scope contributed only while a drawing object is selected; the grid binding applies otherwise.';
for (const [movableKey, other] of [
  ['formatDrawNudgeLeft',       'selection:moveLeft'],
  ['formatDrawNudgeRight',      'selection:moveRight'],
  ['formatDrawNudgeUp',         'selection:moveUp'],
  ['formatDrawNudgeDown',       'selection:moveDown'],
  ['formatDrawNudgeLeftLarge',  'selection:moveContentfulLeft'],
  ['formatDrawNudgeRightLarge', 'selection:moveContentfulRight'],
  ['formatDrawNudgeUpLarge',    'selection:moveContentfulUp'],
  ['formatDrawNudgeDownLarge',  'selection:moveContentfulDown'],
  ['formatDrawSizeIncrease',    'selection:selectRight'],
  ['formatDrawSizeIncrease',    'selection:selectUp'],
  ['formatDrawSizeIncrease',    'selection:selectContentfulRight'],
  ['formatDrawSizeIncrease',    'selection:selectContentfulUp'],
  ['formatDrawSizeDecrease',    'selection:selectLeft'],
  ['formatDrawSizeDecrease',    'selection:selectDown'],
  ['formatDrawSizeDecrease',    'selection:selectContentfulLeft'],
  ['formatDrawSizeDecrease',    'selection:selectContentfulDown'],
  ['deleteDrawings',            'sheet:clearContents'],
  ['selectAllDrawings',         'sheet:selectAll'],
  ['formatDrawRotateLeft',      'selection:traverseSelectionPreviousRange'],
  ['formatDrawRotateRight',     'selection:traverseSelectionNextRange'],
  ['selectNextDrawing',         'selection:traverseSelectionRight'],
  ['selectPreviousDrawing',     'selection:traverseSelectionLeft']
]) {
  ALLOWED.set([`movable:${movableKey}`, other].sort().join('|'), MOVABLE_KEYBOARD_REASON);
}

/**
 * Printable char → `[code, producedWithShift]` on a US layout. `e.code` is the physical key and
 * `e.key` is the character it produces, so these are two spellings of one key; folding to the code
 * (and inferring the shift the character implies) is what makes the two comparable.
 */
const CHAR_TO_CODE = {
  ';': ['Semicolon', false], ':': ['Semicolon', true],
  '=': ['Equal', false],     '+': ['Equal', true],
  ',': ['Comma', false],     '<': ['Comma', true],
  '-': ['Minus', false],     '_': ['Minus', true],
  '.': ['Period', false],    '>': ['Period', true],
  '/': ['Slash', false],     '?': ['Slash', true],
  '`': ['Backquote', false], '~': ['Backquote', true],
  '[': ['BracketLeft', false],  '{': ['BracketLeft', true],
  '\\': ['Backslash', false],   '|': ['Backslash', true],
  ']': ['BracketRight', false], '}': ['BracketRight', true],
  "'": ['Quote', false],     '"': ['Quote', true],
  '1': ['Digit1', false], '!': ['Digit1', true],
  '2': ['Digit2', false], '@': ['Digit2', true],
  '3': ['Digit3', false], '#': ['Digit3', true],
  '4': ['Digit4', false], '$': ['Digit4', true],
  '5': ['Digit5', false], '%': ['Digit5', true],
  '6': ['Digit6', false], '^': ['Digit6', true],
  '7': ['Digit7', false], '&': ['Digit7', true],
  '8': ['Digit8', false], '*': ['Digit8', true],
  '9': ['Digit9', false], '(': ['Digit9', true],
  '0': ['Digit0', false], ')': ['Digit0', true],
  ' ': ['Space', false]
};

/** `code` → `[unshifted char, shifted char]`, inverted from {@link CHAR_TO_CODE}. */
const CODE_TO_CHARS = {};
for (const [char, [code, needsShift]] of Object.entries(CHAR_TO_CODE)) {
  CODE_TO_CHARS[code] ??= [];
  CODE_TO_CHARS[code][needsShift ? 1 : 0] = char;
}

/** `normalizeKeyToken` from `KeyBindingDispatcher` — the runtime's, verbatim in behavior. */
function normalizeKeyToken(raw) {
  if (!raw) return '';
  if (raw.length > 3 && raw.startsWith('Key')) return raw.slice(3).toUpperCase();
  if (raw.length > 5 && raw.startsWith('Digit')) return raw.slice(5);
  if (raw.length === 1) return raw.toUpperCase();
  return raw;
}

/**
 * Is this authored character token DEAD — a spelling no event can produce?
 *
 * The runtime matches an authored shortcut against the two canonicals an event yields, one from
 * `e.code` and one from `e.key`; a character token that equals neither never fires. Rather than
 * guess at which characters are safe, simulate: hold `shift` and `e.key` becomes the key's SHIFTED
 * character, so `ctrl+shift+/` is compared against `Slash` and `?` and matches neither.
 *
 * Digits and letters survive the same treatment only because `normalizeKeyToken` strips their code
 * prefix — `Digit1` normalizes back to `1`, so `ctrl+shift+1` matches on the code side even though
 * `e.key` is `!`. `Slash` does not normalize to `/`. That asymmetry is exactly why this simulates
 * instead of listing.
 *
 * Returns the two candidates when dead (for the message), else `null`.
 */
function deadCharSpelling(token, shift) {
  const entry = CHAR_TO_CODE[token];
  if (!entry) return null;              // a code token (`Slash`, `Enter`) — authored as the code, always fine
  const [code] = entry;
  const chars = CODE_TO_CHARS[code] ?? [];
  const eventKey = (shift ? chars[1] : chars[0]) ?? chars[0] ?? token;
  const candidates = [normalizeKeyToken(code), normalizeKeyToken(eventKey)];
  return candidates.includes(normalizeKeyToken(token)) ? null : candidates;
}

/**
 * The physical identity of an authored shortcut string. Mirrors `keyStrokeToCanonical`
 * (ctrl/meta collapse to `mod`, `Key*` strips, single chars uppercase) and then folds the
 * char↔code spellings above onto the code.
 */
export function physicalChord(str) {
  const parts = str.split('+');
  let token = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());
  const mod = mods.includes('ctrl') || mods.includes('meta');
  const alt = mods.includes('alt');
  let shift = mods.includes('shift');
  let impliedShift = false;
  const dead = deadCharSpelling(token, shift);
  if (token.length > 3 && token.startsWith('Key')) {
    token = token.slice(3).toUpperCase();
  } else if (CHAR_TO_CODE[token]) {
    const [code, needsShift] = CHAR_TO_CODE[token];
    token = code;
    // A shifted character (`_`, `*`, `{`) can only be typed WITH shift, so it implies the modifier.
    // Flag when it wasn't declared: such a shortcut never matches (the event carries shift, the
    // declaration doesn't) — a dead binding, worth surfacing next to the collisions.
    if (needsShift) { impliedShift = !shift; shift = true; }
  } else if (token.length === 1) {
    token = token.toUpperCase();
  }
  return { id: (mod ? 'mod+' : '') + (alt ? 'alt+' : '') + (shift ? 'shift+' : '') + token, impliedShift, dead };
}

const catalogs = [];
const packagesDir = path.join(repoRoot, 'packages');
for (const pkg of fs.readdirSync(packagesDir)) {
  const localesDir = path.join(packagesDir, pkg, 'resources', 'locales');
  if (!fs.existsSync(localesDir)) continue;
  for (const locale of fs.readdirSync(localesDir)) {
    const dir = path.join(localesDir, locale);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.cmd.json'))) {
      catalogs.push({ locale, file: path.join(dir, file), rel: `packages/${pkg}/resources/locales/${locale}/${file}` });
    }
  }
}

// locale → chord id → [{ owner, spelling, rel }]
const byLocale = new Map();
const deadBindings = [];
for (const { locale, file, rel } of catalogs) {
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scope = catalog.scope ?? '?';
  for (const [key, rec] of Object.entries(catalog.commands ?? {})) {
    // `null` = explicitly unbound in this locale (see config/i18n-catalog-build.mjs); claims nothing.
    if (rec.shortcut === undefined || rec.shortcut === null) continue;
    for (const spelling of Array.isArray(rec.shortcut) ? rec.shortcut : [rec.shortcut]) {
      const { id, impliedShift, dead } = physicalChord(spelling);
      if (impliedShift) deadBindings.push(`${rel}  ${scope}:${key}  "${spelling}" — shifted character without \`shift+\`; never matches.`);
      else if (dead) deadBindings.push(`${rel}  ${scope}:${key}  "${spelling}" — never matches: the event yields ${dead.map((c) => `"${c}"`).join(' or ')}, not "${spelling.split('+').pop()}". Author one of those.`);
      if (!byLocale.has(locale)) byLocale.set(locale, new Map());
      const chords = byLocale.get(locale);
      if (!chords.has(id)) chords.set(id, []);
      chords.get(id).push({ owner: `${scope}:${key}`, spelling, rel });
    }
  }
}

const collisions = [];
const seenAllowed = new Set();
for (const [locale, chords] of byLocale) {
  for (const [id, claims] of chords) {
    const owners = [...new Set(claims.map((c) => c.owner))].sort();
    if (owners.length < 2) continue;
    // Allowed only when EVERY pair in the group is declared intentional.
    const pairs = [];
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) pairs.push(`${owners[i]}|${owners[j]}`);
    }
    const unallowed = pairs.filter((p) => !ALLOWED.has(p));
    pairs.filter((p) => ALLOWED.has(p)).forEach((p) => seenAllowed.add(p));
    if (unallowed.length === 0) continue;
    collisions.push({ locale, id, claims, unallowed });
  }
}

for (const { locale, id, claims } of collisions) {
  console.error(`COLLISION [${locale}] ${id}`);
  for (const c of claims) console.error(`    ${c.owner.padEnd(44)} "${c.spelling}"   ${c.rel}`);
}
if (collisions.length) {
  console.error(`\n  One physical keystroke, ${collisions.length > 1 ? 'several commands' : 'two commands'}. Dispatch takes whichever \`collectKeys()\``);
  console.error('  yields first and does NOT fall through if it resolves disabled, so one of these is dead.');
  console.error('  Fix: drop the duplicate binding, or — if both are genuinely contextual and both carry');
  console.error('  behavior — add the pair to ALLOWED in scripts/command-chord-lint.mjs with the reason.\n');
}

const stale = [...ALLOWED.keys()].filter((p) => !seenAllowed.has(p));
if (stale.length) {
  console.error(`STALE ALLOWED (${stale.length}) — no longer collide; delete from scripts/command-chord-lint.mjs:`);
  for (const p of stale) console.error(`    ${p}`);
}
if (deadBindings.length) {
  console.error(`DEAD BINDING (${deadBindings.length}):`);
  for (const d of deadBindings) console.error(`    ${d}`);
}

const problems = collisions.length + stale.length + deadBindings.length;
if (problems === 0) {
  console.log(`✓ ${catalogs.length} catalog(s): no chord collisions (${ALLOWED.size} intentional re-binds allowed)`);
}
if (checkOnly && problems > 0) { console.error(`FAILED: ${problems} chord problem(s).`); process.exit(1); }
process.exit(problems > 0 ? 1 : 0);
