/**
 * The stacking bands floating UI sits in. Three tokens (`--sxl-z-*`), ordered:
 *
 * | token | default | what sits there |
 * | --- | --- | --- |
 * | `grid` | 1250 | floats anchored to the grid — labels, chips, hover tips, touch grips. Above app chrome (an app drawer is 1200), below the popup band so a menu covers them. |
 * | `popup` | 1300 | popups, menus and panels (the float stack), modal windows. MUI's modal band. |
 * | `tooltip` | 1500 | tooltips of the chrome and menus, and gesture readouts — out-stack menus, as MUI's do. |
 *
 * The values are tokens so a host can move a band (`'z-popup'` in its {@link TokenTheme}) without every
 * consumer knowing; a consumer reads the band through {@link zIndexVar} and never writes a number.
 */
export type ZIndexToken = 'grid' | 'popup' | 'tooltip';

/** The default value of each band — what {@link zIndexVar} falls back to when the token is unset. */
export const Z_INDEX: Readonly<Record<ZIndexToken, number>> = { grid: 1250, popup: 1300, tooltip: 1500 };

/**
 * A band as a CSS `z-index` value: `var(--sxl-z-<token>, <default>)`, optionally offset (`delta`) within
 * the band — `zIndexVar('grid', 1)` lifts one float above its siblings. The result is a string for an
 * inline `zIndex` style (or a stylesheet), not a number.
 */
export const zIndexVar = (token: ZIndexToken, delta: number = 0): string => {
  return offsetZIndex(`var(--sxl-z-${token}, ${Z_INDEX[token]})`, delta) as string;
};

/** `z` moved by `delta` — arithmetic on a number, `calc()` on a var expression. */
export const offsetZIndex = (z: number | string, delta: number): number | string => {
  if (!delta) return z;
  if (typeof z === 'number') return z + delta;
  return `calc(${z} ${delta < 0 ? '-' : '+'} ${Math.abs(delta)})`;
};
