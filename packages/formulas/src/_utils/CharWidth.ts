/**
 * Half-width and full-width conversion for `ASC` and `DBCS`.
 *
 * @remarks
 * Follows Windows `LCMapStringEx` with `LCMAP_HALFWIDTH` / `LCMAP_FULLWIDTH`, which answers the same
 * under every language with two widths — the only languages under which the conversion applies.
 *
 * The rules are the Unicode Halfwidth and Fullwidth Forms block. Two departures come from Windows:
 * the backslash stays as it is in both directions, and the block's halfwidth arrows, box drawing and
 * shapes (U+FFE8 to U+FFEE) are not converted. Windows also composes any base and combining mark
 * going to full width (`e` and U+0301 become U+00E9); only kana and Hangul compose here.
 */

/** The symbols whose two widths are not a fixed distance apart, as `[half, full]`. */
const SYMBOLS: readonly (readonly [number, number])[] = [
  [0xA2, 0xFFE0], [0xA3, 0xFFE1], [0xAC, 0xFFE2], [0xAF, 0xFFE3],
  [0xA6, 0xFFE4], [0xA5, 0xFFE5], [0x20A9, 0xFFE6]
];

/** The halfwidth Hangul letters, as inclusive runs. Together they follow U+3131 without a gap. */
const HANGUL_RUNS: readonly (readonly [number, number])[] = [
  [0xFFA1, 0xFFBE], [0xFFC2, 0xFFC7], [0xFFCA, 0xFFCF], [0xFFD2, 0xFFD7], [0xFFDA, 0xFFDC]
];

const FULL_WIDTH_OFFSET = 0xFEE0;
const COMBINING_VOICED = 0x3099;
const COMBINING_SEMI_VOICED = 0x309A;
const SPACING_VOICED = 0x309B;
const SPACING_SEMI_VOICED = 0x309C;
const HALF_VOICED = 0xFF9E;
const HALF_SEMI_VOICED = 0xFF9F;

const char = (code: number): string => String.fromCharCode(code);

type WidthMaps = { toFull: Map<string, string>, toHalf: Map<string, string> };

let _maps: WidthMaps | null = null;

const getMaps = (): WidthMaps => {
  if (_maps) return _maps;
  const toFull = new Map<string, string>();
  const toHalf = new Map<string, string>();
  const pair = (half: number, full: number): void => {
    toFull.set(char(half), char(full));
    toHalf.set(char(full), char(half));
  };

  pair(0x20, 0x3000);
  for (let code = 0x21; code <= 0x7E; code++) {
    if (code !== 0x5C) pair(code, code + FULL_WIDTH_OFFSET);
  }
  for (const [half, full] of SYMBOLS) pair(half, full);

  for (let code = 0xFF61; code <= HALF_SEMI_VOICED; code++) {
    pair(code, char(code).normalize('NFKC').charCodeAt(0));
  }

  pair(0xFFA0, 0x3164);
  let jamo = 0x3131;
  for (const [start, end] of HANGUL_RUNS) {
    for (let code = start; code <= end; code++) pair(code, jamo++);
  }

  // Many to one: these have a half-width form but are not what that form converts back to.
  toHalf.set(char(0x2018), "'");
  toHalf.set(char(0x2019), "'");
  toHalf.set(char(0x201C), '"');
  toHalf.set(char(0x201D), '"');
  toHalf.set(char(SPACING_VOICED), char(HALF_VOICED));
  toHalf.set(char(SPACING_SEMI_VOICED), char(HALF_SEMI_VOICED));
  toFull.set(char(SPACING_VOICED), char(COMBINING_VOICED));
  toFull.set(char(SPACING_SEMI_VOICED), char(COMBINING_SEMI_VOICED));

  // A voiced katakana has no half-width form of its own: it becomes the base and a separate mark.
  for (let code = 0x30A1; code <= 0x30FE; code++) {
    const decomposed = char(code).normalize('NFD');
    if (decomposed.length === 2) {
      const base = decomposed[0];
      toHalf.set(char(code), (toHalf.get(base) ?? base) + toHalf.get(decomposed[1]));
    }
  }

  _maps = { toFull, toHalf };
  return _maps;
};

const FULL_WIDTH_SOURCE = /[\x20-\x7E\xA2-\xAF\u20A9\u309B\u309C\uFF61-\uFFDC]/g;
const HALF_WIDTH_SOURCE = /[\u2018\u2019\u201C\u201D\u3000-\u30FE\u3131-\u3164\uFF01-\uFFE6]/g;
/** Hangul compatibility letters that spell a syllable: a leading consonant, a vowel, a final that only ends one. */
const HANGUL_LETTERS = /[\u3131\u3132\u3134\u3137-\u3139\u3141-\u3143\u3145-\u314E][\u314F-\u3163][\u3133\u3135\u3136\u313A-\u313F]?/g;
/** What composes: a kana and its voiced mark, and conjoining Hangul. */
const COMPOSABLE = /[\u3041-\u30FE][\u3099\u309A]|[\u1100-\u1112][\u1161-\u1175][\u11A8-\u11C2]?|[\uAC00-\uD7A3][\u11A8-\u11C2]/g;

/**
 * Converts every character that has a full-width form to it, then composes what the conversion left
 * side by side: a kana and its voiced mark become one character, and Hangul letters one syllable.
 */
export const toFullWidth = (text: string): string => {
  const { toFull } = getMaps();
  return text
    .replace(FULL_WIDTH_SOURCE, (c) => toFull.get(c) ?? c)
    .replace(HANGUL_LETTERS, (letters) => letters.normalize('NFKC'))
    .replace(COMPOSABLE, (run) => run.normalize('NFC'));
};

/**
 * Converts every character that has a half-width form to it. A voiced katakana becomes two
 * characters, so the result can be longer than `text`.
 */
export const toHalfWidth = (text: string): string => {
  const { toHalf } = getMaps();
  return text.replace(HALF_WIDTH_SOURCE, (c) => toHalf.get(c) ?? c);
};
