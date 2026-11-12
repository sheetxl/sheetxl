import { type ThemeMode } from './TokenTheme';

/**
 * The two attributes a container sets to **select** a cell of the `(token × surface × mode)` matrix. The
 * value cells live in the injected stylesheet (see {@link buildThemeCSS}); a consumer just reads
 * `var(--sxl-*)` and knows nothing about mode/surface. See THEMING-DESIGN.md.
 */
export const THEME_MODE_ATTR = 'data-sxl-theme-mode';
export const THEME_SURFACE_ATTR = 'data-sxl-theme-surface';

export interface ThemeAttrs {
  'data-sxl-theme-mode'?: ThemeMode;
  'data-sxl-theme-surface'?: string;
}

/**
 * The selection attributes for a surface container, ready to spread onto the element — e.g.
 * `<div {...themeSurfaceProps('grid', 'dark')}>`.
 *
 * `mode` is required: a surface container always states its own mode, so every themed region matches the
 * compound `[data-sxl-theme-mode][data-sxl-theme-surface]` selector — the one a client override addresses.
 */
export const themeSurfaceProps = (surface: string, mode: ThemeMode): ThemeAttrs => ({
  [THEME_SURFACE_ATTR]: surface,
  [THEME_MODE_ATTR]: mode
});

/**
 * A stable, CSS-safe per-instance scope **class name** (no leading dot) for a theme instance root — e.g.
 * `sheetxl-studio-r0`. Set it as the element's `className` and, for the matching `@scope` selector, prefix a
 * dot: `@scope (.${cls})`.
 *
 * `id` is typically a React `useId()` value, which is wrapped in colons (`":r0:"`) — invalid in a class name
 * and, unescaped, a broken selector. Every non-`[A-Za-z0-9_-]` character is stripped so the result is valid
 * in both a `class` attribute and a selector, while staying unique (the colons only delimit, they don't
 * distinguish). Prefer a component-instance id (`useId()`) over data ids so the scope is stable across the
 * data the component renders.
 */
export const createThemeScopeClass = (instanceType: string, id: string): string => {
  const safe = id.replace(/[^A-Za-z0-9_-]/g, '');
  return `sheetxl-${instanceType}-${safe}`;
};
