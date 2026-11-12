/**
 * Text search for the shortcut keys panel.
 *
 * Every word of the query must match a word of the row. A match is first looked for as a word
 * prefix ("grou" finds "Group", "sum" finds "AutoSum"). Typo tolerance is only a fallback for a
 * query that finds nothing that way: a fuzzy hit inside "Background" is noise when the query
 * "group" already lists the grouping commands.
 *
 * A fuzzy match also has to account for the query word's last character. A transposed or doubled
 * letter is a typo ("gropu" → "group"); a trailing character the word does not contain at all
 * usually means a different word ("group2", "groun" for "ground"), so it does not match. Vowels
 * are exempt because they are the letters most often fumbled ("groupe").
 */

export interface ShortcutSearchFields {
  label: string;
  scope: string;
  scopeLabel: string;
  description: string;
}

/** How much a hit in each field counts toward a row's rank. */
const WEIGHT_LABEL = 3;
const WEIGHT_SCOPE = 2;
const WEIGHT_DESCRIPTION = 1;

/** Query words shorter than this never match fuzzily; there are too many near neighbors. */
const FUZZY_MIN_LENGTH = 4;

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/** Lowercase words, with camel case split ("AutoSum" → "auto", "sum"). */
const toWords = (text: string): string[] => {
  if (!text) return [];
  return text
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
};

/** Edit distance where an adjacent transposition counts as one edit. */
const editDistance = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = [];
  for (let i = 0; i < rows; i++) {
    d.push(new Array(cols).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
    }
  }
  return d[rows - 1][cols - 1];
};

/**
 * The fewest edits that turn `token` into a prefix of `word` (of about the token's length), or
 * `-1` if the word is out of reach or fails the last-character rule.
 */
const fuzzyEdits = (token: string, word: string): number => {
  const len = token.length;
  if (len < FUZZY_MIN_LENGTH || word.length < len - 1) return -1;
  const last = token[len - 1];
  if (!VOWELS.has(last) && !word.includes(last)) return -1;
  const maxEdits = len >= 8 ? 2 : 1;
  let best = -1;
  for (let k = len - 1; k <= Math.min(len + 1, word.length); k++) {
    const edits = editDistance(token, word.slice(0, k));
    if (edits <= maxEdits && (best === -1 || edits < best)) best = edits;
  }
  return best;
};

interface IndexedRow<T> {
  item: T;
  label: string[];
  scope: string[];
  description: string[];
}

const prefixScore = (token: string, row: IndexedRow<unknown>): number => {
  const hit = (words: string[]): boolean => words.some((w) => w.startsWith(token));
  if (hit(row.label)) return WEIGHT_LABEL;
  if (hit(row.scope)) return WEIGHT_SCOPE;
  if (hit(row.description)) return WEIGHT_DESCRIPTION;
  return 0;
};

/** Fuzzy hits are looked for in the label and scope only; descriptions are too wordy to fuzz. */
const fuzzyScore = (token: string, row: IndexedRow<unknown>): number => {
  const best = (words: string[], weight: number): number => {
    let score = 0;
    for (const w of words) {
      const edits = fuzzyEdits(token, w);
      if (edits >= 0) score = Math.max(score, weight / (1 + edits));
    }
    return score;
  };
  return Math.max(best(row.label, WEIGHT_LABEL), best(row.scope, WEIGHT_SCOPE));
};

/**
 * Returns a search function over `items`. Results are ranked by where the words hit (label, then
 * scope, then description) and otherwise keep the order of `items`. An empty query returns
 * `items` unchanged.
 */
export const createShortcutSearch = <T extends ShortcutSearchFields>(items: readonly T[]): (query: string) => T[] => {
  const rows: IndexedRow<T>[] = items.map((item) => ({
    item,
    label: toWords(item.label),
    scope: [...toWords(item.scope), ...toWords(item.scopeLabel)],
    description: toWords(item.description),
  }));

  const rank = (tokens: string[], allowFuzzy: boolean): T[] => {
    const scored: { item: T; score: number; order: number }[] = [];
    rows.forEach((row, order) => {
      let score = 0;
      for (const token of tokens) {
        let s = prefixScore(token, row);
        if (s === 0 && allowFuzzy) s = fuzzyScore(token, row);
        if (s === 0) return;
        score += s;
      }
      scored.push({ item: row.item, score, order });
    });
    scored.sort((a, b) => (b.score - a.score) || (a.order - b.order));
    return scored.map((s) => s.item);
  };

  return (query: string): T[] => {
    const tokens = toWords(query);
    if (tokens.length === 0) return [...items];
    const exact = rank(tokens, false);
    return exact.length > 0 ? exact : rank(tokens, true);
  };
};
