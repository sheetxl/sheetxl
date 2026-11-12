/**
 * Read resolved `--sxl-*` token values off a live element via `getComputedStyle`.
 *
 * This is the escape hatch for the few consumers that CSS `var()` cannot reach — a `<canvas>`, an SVG
 * `data:` URI, or SDK interop — where a concrete color string is required. Because it reads the *computed*
 * style of `el`, the value already reflects that element's surface, mode, and any override, with no
 * configuration and no theme context (see THEMING-DESIGN.md, decision 1). It is the counterpart to the
 * CSS-first read path; do NOT use it where a plain `var(--sxl-*)` works.
 *
 * SSR / detached element: returns `undefined` / `{}` so the caller falls back to its literal. Never throws.
 *
 * `name` is a {@link TokenTheme} key (e.g. `'color-base-100'`) or a full custom-property name
 * (e.g. `'--sxl-color-base-100'`); the `--sxl-` prefix is added when absent.
 */
export function resolveToken(el: Element | null | undefined, name: string): string | undefined {
  if (!el || typeof getComputedStyle === 'undefined') return undefined;
  const value = getComputedStyle(el).getPropertyValue(toVarName(name)).trim();
  return value === '' ? undefined : value;
}

/**
 * Batch form of {@link resolveToken} — resolves several tokens from a single `getComputedStyle` read.
 * Returns a record keyed by the input `names` (unresolved/empty tokens are omitted).
 */
export function resolveTokens(
  el: Element | null | undefined,
  names: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!el || typeof getComputedStyle === 'undefined') return out;
  const style = getComputedStyle(el);
  for (const name of names) {
    const value = style.getPropertyValue(toVarName(name)).trim();
    if (value !== '') out[name] = value;
  }
  return out;
}

function toVarName(name: string): string {
  return name.startsWith('--') ? name : `--sxl-${name}`;
}
