import { type TokenTheme } from './TokenTheme';
import { defaultTheme, SERIES_COUNT, BRACKET_COUNT } from './defaultTheme';

/** The tokens that are a fixed-length list, emitted as numbered vars (`--sxl-color-series-1..N`). */
type ListToken = 'color-series' | 'color-bracket';
type ScalarToken = Exclude<keyof TokenTheme, ListToken>;

const LIST_COUNT: Record<ListToken, number> = {
  'color-series': SERIES_COUNT,
  'color-bracket': BRACKET_COUNT
};

/**
 * A CSS `var()` reading a theme token, with the light default as its fallback.
 *
 * Use it wherever a component paints a token in inline styles or SVG attributes. The fallback applies only
 * when no theme stylesheet is in force (a bare grid with no `ThemeRootStyles` above it), and it comes from
 * {@link defaultTheme}, so it cannot drift from the real default.
 *
 * ```ts
 * tokenVar('color-base-300')     // 'var(--sxl-color-base-300, #e0e0e0)'
 * tokenVar('color-series', 2)    // 'var(--sxl-color-series-3, …)': zero-based, rotates past the end
 * ```
 */
export function tokenVar(key: ScalarToken): string;
export function tokenVar(key: ListToken, index: number): string;
export function tokenVar(key: keyof TokenTheme, index?: number): string {
  if (key === 'color-series' || key === 'color-bracket') {
    const count = LIST_COUNT[key];
    const i = ((index ?? 0) % count + count) % count;
    const name = `--sxl-${key}-${i + 1}`;
    const fallback = defaultTheme.light[key]?.[i];
    return fallback == null ? `var(${name})` : `var(${name}, ${fallback})`;
  }
  const fallback = defaultTheme.light[key];
  return fallback == null ? `var(--sxl-${key})` : `var(--sxl-${key}, ${fallback})`;
}
