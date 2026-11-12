import { type Scalar } from './Scalar';

/** The characters that must be escaped to appear literally in a JS regex. */
const _REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/;
const _escapeRegExp = (ch: string): string => (_REGEXP_SPECIAL.test(ch) ? '\\' + ch : ch);

/**
 * Wildcard syntax: `*` for any run of characters, `?` for exactly one, `~` to escape.
 */
export const WildCard = {
  /**
   * Indicates if the give item is a wildcard string.
   */
  isWildCard: (obj: Scalar): boolean => {
    if (typeof obj === "string")
      return /[*?]/.test(obj);
    return false;
  },

  /**
   * Compiles Excel wildcard text into a regex.
   *
   * @param anchor Where the pattern has to line up: `true` for the WHOLE string, `'start'` for a
   * PREFIX, `false` for anywhere in it. A criterion matches a whole cell, so every lookup and criteria
   * caller anchors; `SEARCH`, which looks for a substring, does not; and a `D` function's criteria
   * table is the prefix form — `DSUM` with the criterion `appl` takes the row whose value is
   * `Apple`, where `COUNTIF` with the same criterion takes none.
   *
   * @remarks
   * `~` escapes the next `*`, `?` or `~`; before anything else it is dropped, not kept —
   * `SEARCH("~b","abc")` is 2 and `MATCH("a~b",…)` finds the text `ab`. A caller that reaches this
   * compiler only when the pattern holds a `*` or `?` — which is what COUNTIF and its family do —
   * therefore still compares `"a~b"` literally, because that criteria never becomes a pattern.
   *
   * One left-to-right pass; chained replaces cannot express the escape, since by the time a pass
   * could unescape `~*` the `*` has already become `.*`.
   */
  toRegex: (lookupText: string, flags?: any, anchor: boolean | 'start' = false): RegExp => {
    let pattern = '';
    const length = lookupText.length;
    for (let i=0; i<length; i++) {
      const ch = lookupText[i];
      if (ch === '~') {
        const next = lookupText[i + 1];
        if (next === '*' || next === '?' || next === '~') {
          pattern += _escapeRegExp(next);
          i++;
        }
        continue;
      }
      // `[\s\S]`, not `.`: wildcards match a line terminator and a JavaScript dot does
      // not — `SEARCH("a?b","a" & CHAR(10) & "b")` is 1.
      if (ch === '*') { pattern += '[\\s\\S]*'; continue; }
      if (ch === '?') { pattern += '[\\s\\S]'; continue; }
      pattern += _escapeRegExp(ch);
    }
    if (anchor === 'start') return RegExp(`^${pattern}`, flags);
    return RegExp(anchor ? `^${pattern}$` : pattern, flags);
  }
};
