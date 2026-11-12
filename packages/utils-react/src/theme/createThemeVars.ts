import { type CSSProperties } from 'react';

import { type TokenTheme, type ThemeMode } from './TokenTheme';
import { defaultTheme } from './defaultTheme';

/**
 * Runtime generator. Because each token key IS the var name minus the prefix, this is trivial: prepend
 * `--sxl-`. No build step, no static stylesheet — just a flat {@link TokenTheme} → a style object.
 */

const PREFIX = '--sxl-';

/**
 * Flat theme (token values) → `--sxl-*` style object (skips `undefined`). An **array** token expands to a
 * 1-based numbered ramp (`--sxl-color-series-1`, `-2`, …), matching {@link buildThemeCSS}'s stylesheet form.
 */
export function toVars(theme: Partial<TokenTheme> | Record<string, string | string[] | undefined>): CSSProperties {
  const out: Record<string, string> = {};
  for (const key in theme) {
    const value = (theme as Record<string, string | string[] | undefined>)[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) => { if (v != null) out[`${PREFIX}${key}-${i + 1}`] = String(v); });
    } else {
      out[`${PREFIX}${key}`] = String(value);
    }
  }
  return out as CSSProperties;
}

/**
 * The single entry: resolve `--sxl-*` vars for a mode, with any number of partial overrides merged over
 * the default theme (later wins). A *surface* is just an overrides partial — e.g. grid-react's
 * `GRID_SURFACE[mode]` — so `themeVars(mode, GRID_SURFACE[mode])` yields the grid surface, and a client's
 * brand tweak is one more partial: `themeVars(mode, GRID_SURFACE[mode], { 'color-accent': 'purple' })`.
 */
export function themeVars(mode: ThemeMode, ...overrides: Array<Partial<TokenTheme> | undefined>): CSSProperties {
  const merged: TokenTheme = Object.assign({}, defaultTheme[mode], ...overrides.filter(Boolean));
  return toVars(merged);
}
