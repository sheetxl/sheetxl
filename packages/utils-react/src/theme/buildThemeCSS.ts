import { type TokenTheme, type ThemeMode } from './TokenTheme';
import { defaultTheme } from './defaultTheme';

/**
 * Emit the theme stylesheet — the injected `<style>` the two-attribute model needs (attribute-scoped rules
 * can't be inline). Two orthogonal attributes select the value:
 *   - `data-sxl-theme-mode`    (default: light) → sets `color-scheme` + the mode's token values.
 *   - `data-sxl-theme-surface` (default: app)   → sets a surface's token overrides.
 *
 * Because values are keyed by both, each surface emits a `[mode] [surface]` rule (mode on an ancestor) AND
 * the compound `[mode][surface]` (mode on the surface element itself, e.g. a light grid in a dark app).
 * ALL compound rules are emitted AFTER all descendant rules: a surface that declares its own mode matches
 * both forms at equal specificity (its own mode compound, and its ancestor's mode descendant), so the
 * compound must come later in source order to win. Otherwise a light grid under a dark app root would pick
 * up the dark descendant rule (dark emitted after light) and render dark.
 *
 * NOT using `light-dark()` — values are explicit per mode (the extra CSS is machine-generated, invisible
 * to authors, and buys universal support + no unregistered-token caveat).
 */

const MODES: ThemeMode[] = ['light', 'dark'];

/**
 * Per-element override hook for the generic text-selection tint (below). An element sets this custom
 * property to retint or clear (`transparent`) its own selection without a bespoke `::selection` rule —
 * e.g. the formula editor clears it while its hover eval-run band is shown so the two same-colored
 * highlights don't stack.
 */
export const INPUT_SELECTION_VAR = '--sxl-input-selection';

/**
 * The generic selection tint: `--sxl-color-primary` at a low alpha, so text stays readable through it and
 * it follows light/dark + any brand override automatically. Shared so a component painting its own matching
 * "highlight" surface (the formula editor's eval-run band) reads as the same system, not a hardcoded blue.
 */
export const INPUT_SELECTION_TINT = 'color-mix(in srgb, var(--sxl-color-primary, rgb(0, 120, 215)) 20%, transparent)';

/**
 * Generic **text-selection** styling for form inputs — a base element rule, not a token declaration. The
 * browser/OS default selection highlight is theme-unaware (dark-blue-on-dark-grey in a dark app, near
 * unreadable), so theme it here: the theme sheet is the one place every themed subtree already funnels
 * through, so app inputs (panels, dialogs, the formula bar…) all pick it up with no per-input wiring.
 *
 * Zero-specificity (`:where`) + emitted in the theme layer, so any author rule wins; each element can retint
 * or opt out via {@link INPUT_SELECTION_VAR}. Scoped/layered with the tokens: inside `@scope` it touches only
 * this instance's inputs; unscoped (a global provider / storybook) it is page-wide, matching that provider's
 * whole-document theming.
 */
const SELECTION_RULE =
  `:where(input,textarea,[contenteditable]:not([contenteditable="false"]))::selection` +
  `{background-color:var(${INPUT_SELECTION_VAR},${INPUT_SELECTION_TINT});}`;

/**
 * The canonical `@layer` cascade (lowest → highest priority). A later layer wins over an earlier one
 * regardless of specificity, so the whole model is: grid-react emits neutral defaults into `sxl-defaults`,
 * studio-mui emits its MUI-derived values into `sxl-app`, and clients override in `sxl-overrides`. Consumers
 * read `var(--sxl-*)` UNLAYERED, so they (and inline one-offs) still beat every layer.
 */
export const SXL_THEME_LAYERS = ['sxl-defaults', 'sxl-app', 'sxl-overrides'] as const;
export type SxlThemeLayer = typeof SXL_THEME_LAYERS[number];

/**
 * The `@layer a, b, c;` order statement. Emit it at the top of EVERY layered sheet (idempotent): CSS derives
 * layer order from first appearance, so without an explicit declaration the order would depend on which sheet
 * (studio vs. Sheet) mounted first. Declaring it makes `sxl-app` beat `sxl-defaults` regardless of load order.
 */
export const SXL_THEME_LAYER_ORDER = `@layer ${SXL_THEME_LAYERS.join(', ')};`;

/**
 * Flat theme → `--sxl-*:v;` declarations. An **array** token expands to a 1-based numbered ramp
 * (`--sxl-color-series-1`, `-2`, …) — CSS has no array type, and 1-based reads naturally (matches VS Code's
 * `editorBracketHighlight.foregroundN`).
 */
function decls(theme: Partial<TokenTheme>): string {
  let out = '';
  for (const key in theme) {
    const value = (theme as Record<string, string | string[] | undefined>)[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) => { if (v != null) out += `--sxl-${key}-${i + 1}:${v};`; });
    } else {
      out += `--sxl-${key}:${value};`;
    }
  }
  return out;
}

export interface ThemeCSSOptions {
  /** App baseline per mode. @defaultValue `defaultTheme` */
  app?: Record<ThemeMode, TokenTheme>;
  /** Extra surfaces: name → per-mode partial overrides (e.g. `{ grid: GRID_SURFACE, header: HEADER_SURFACE }`). */
  surfaces?: Record<string, Partial<Record<ThemeMode, Partial<TokenTheme>>>>;
  /** High-contrast override tokens (rides the `mode="hc"` value). */
  hc?: Partial<TokenTheme>;
  modeAttr?: string;
  surfaceAttr?: string;
  /**
   * Wrap all emitted rules in `@layer <layer>{…}` (and prepend {@link SXL_THEME_LAYER_ORDER} so the cascade
   * order is deterministic). Omit for an unlayered sheet (e.g. storybook one-offs). See {@link SXL_THEME_LAYERS}.
   */
  layer?: SxlThemeLayer | string;
  /**
   * Wrap the theme rules in `@scope (<scopeSelector>){…}` so this instance's tokens don't collide with
   * other instances or shadow DOM boundaries (design §6). When both `layer` and `scope` are set the nesting
   * is `@layer <layer>{ @scope (<sel>){ rules } }` — the layer-order statement stays top-level (layers are
   * document-global) and `@scope` binds only the rules. Inside a scope the defaults attach to `:scope`
   * (the scope root), not `:root`. Omit for a global sheet.
   */
  scope?: string;
  /**
   * Emit the baseline-only rules: the zero-specificity defaults for elements that carry no theme attribute
   * (the light cell on the root and on each surface), and the generic input text-selection rule. A baseline
   * sheet needs them. An override sheet must not emit them: a later layer beats an earlier one regardless of
   * specificity, so a value stated only for light would also land on dark elements, and the selection rule
   * would outrank a host's own layered styling.
   * @defaultValue true
   */
  baseline?: boolean;
}

/** Build the injectable theme CSS from the app baseline + surface overrides. */
export function buildThemeCSS(options: ThemeCSSOptions = {}): string {
  const {
    app = defaultTheme,
    surfaces = {},
    hc,
    modeAttr = 'data-sxl-theme-mode',
    surfaceAttr = 'data-sxl-theme-surface',
    layer,
    scope,
    baseline = true
  } = options;

  const rules: string[] = [];

  // The app cell is emitted BOTH as the root default and as an addressable surface, so `app` selects it
  // like any other name. Without this, app chrome is the one cell a nested element cannot opt back into:
  // a region inside another surface (the grid's own frame, drawn from within the grid; a chrome control
  // hosted in a header) could only reach it through a hand-captured var. It is the mirror of a grid island
  // in the chrome — the selected sheet tab — and costs the app token set re-emitted per surface rule.
  // A caller that states its own `app` surface overrides this.
  const allSurfaces: Record<string, Partial<Record<ThemeMode, Partial<TokenTheme>>>> = {
    app: { light: app.light, dark: app.dark },
    ...surfaces
  };

  // The "root" the no-attribute defaults attach to. Unscoped: `:root` (the document root). Scoped: `:scope`
  // (the instance root the `@scope` wrapper binds to) — inside `@scope`, `:root` refers to `<html>`, which
  // sits OUTSIDE the scope and never matches, so the defaults would silently not apply. `:scope` is the
  // in-scope equivalent, so a scoped instance's own root carries the baseline (matters for the no-mode-attr /
  // chromeless case; when a mode attr IS set, the `[mode]` rules below carry it regardless).
  const rootSel = scope ? ':scope' : ':root';

  // Inside `@scope`, a BARE selector (`[mode]`, `[surface]`) matches in-scope DESCENDANTS but NOT the scoping
  // root itself — only `:scope` matches the root. A rule whose SUBJECT can BE the scope root therefore needs a
  // `:scope`-qualified twin or it silently fails on the root (the root keeps the `:where(:scope)` light default
  // and inherits it to everything). `selfSel` adds that twin (`:scope<sel>,<sel>`) for such rules — the app
  // `[mode]` (root sets its own mode) and the compound `[mode][surface]` (a float wrapper is a scope root
  // carrying its own mode+surface). No-op (bare) when unscoped.
  const selfSel = (attrs: string): string => scope ? `:scope${attrs},${attrs}` : attrs;
  const whereSurface = (name: string): string => scope
    ? `:where(:scope[${surfaceAttr}="${name}"],[${surfaceAttr}="${name}"])`
    : `:where([${surfaceAttr}="${name}"])`;
  // The DESCENDANT rule (`[mode] [surface]`, ancestor-mode) deliberately gets NO `:scope` twin. `:scope` adds
  // (0,1,0), which would lift it to (0,3,0) and beat the compound `[mode][surface]` (0,2,0) — silently
  // overriding a surface that flips its OWN mode (a light grid in a dark app). Keeping it bare holds it at
  // (0,2,0), EQUAL to the compound, so the compound (emitted later) wins by source order. The only case this
  // drops — a mode-less surface adopter whose SOLE mode-ancestor is the scope root — doesn't arise (grid/header
  // adopters carry their own mode; the workbook root re-sets mode as an intermediate ancestor).
  const descSel = (anc: string, sub: string): string => `${anc} ${sub}`;

  // Defaults (no attribute): app = light, surfaces = their light overrides. `:where` keeps specificity 0
  // so any explicit mode/surface rule — and inline one-off overrides — win. Light is the deterministic
  // no-attribute default (matches Excel/print fidelity). OS-follow is an explicit caller choice — set the
  // `data-sxl-theme-mode` attr from `matchMedia('(prefers-color-scheme:dark)')`, which flips the whole
  // subtree coherently — NOT baked in here (a CSS-level default can only re-declare tokens per surface, so
  // an inherited-light surface would get a dark fill while its inherited text stays light: dark-on-dark).
  if (baseline) {
    rules.push(`:where(${rootSel}){color-scheme:light;${decls(app.light)}}`);
    for (const [name, perMode] of Object.entries(allSurfaces)) {
      const light = perMode?.light;
      if (light && Object.keys(light).length) rules.push(`${whereSurface(name)}{${decls(light)}}`);
    }
  }

  // Per mode: app tokens + color-scheme (subject can be the scope root → `selfSel`), then each surface's
  // DESCENDANT override (mode on an ancestor that can be the scope root → `descSel`).
  for (const mode of MODES) {
    rules.push(`${selfSel(`[${modeAttr}="${mode}"]`)}{color-scheme:${mode};${decls(app[mode])}}`);
    for (const [name, perMode] of Object.entries(allSurfaces)) {
      const t = perMode?.[mode];
      if (!t || !Object.keys(t).length) continue;
      rules.push(`${descSel(`[${modeAttr}="${mode}"]`, `[${surfaceAttr}="${name}"]`)}{${decls(t)}}`);
    }
  }

  // Compound forms LAST (mode on the surface element itself; subject can be the scope root → `selfSel`). Must
  // follow the descendant rules so a surface that flips its own mode — a light grid inside a dark app — wins
  // over the ancestor-mode descendant rule at equal specificity.
  for (const mode of MODES) {
    for (const [name, perMode] of Object.entries(allSurfaces)) {
      const t = perMode?.[mode];
      if (!t || !Object.keys(t).length) continue;
      rules.push(`${selfSel(`[${modeAttr}="${mode}"][${surfaceAttr}="${name}"]`)}{${decls(t)}}`);
    }
  }

  // High-contrast: an additive override on the same `mode` attribute (light/dark are 2-valued, hc is not a
  // co-equal palette — just a few overrides). color-scheme stays light unless the caller sets it.
  if (hc && Object.keys(hc).length) rules.push(`${selfSel(`[${modeAttr}="hc"]`)}{${decls(hc)}}`);

  // Generic base element styling that rides the token cascade (scoped + layered with everything above).
  if (baseline) rules.push(SELECTION_RULE);

  let result = rules.join('\n');
  // Scoped (design §6): the theme is per-instance, not global. Nest `@scope` INSIDE the layer (below), so the
  // `@layer` order statement stays at the top level where it establishes the document-global cascade order,
  // and only the rules are scope-bound. `:scope` (set above via `rootSel`) resolves to the scope root.
  if (scope) {
    result = `@scope (${scope}){\n${result}\n}`;
  }
  // Unlayered: rules land in the implicit outer layer (beats every explicit @layer) — fine for a standalone
  // sheet. Layered: the order statement + wrapper make this sheet compose with the others by layer priority.
  if (layer) {
    result = `${SXL_THEME_LAYER_ORDER}\n@layer ${layer}{\n${result}\n}`;
  }
  return result;
}
