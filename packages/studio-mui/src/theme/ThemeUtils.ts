import { type Theme, type ThemeOptions } from '@mui/material';

import { type TokenTheme, type ThemeMode, defaultTheme } from '@sheetxl/utils-react';

import { buildGridThemeCSS } from '@sheetxl/grid-react';

import { type ExplicitTokens, type ExplicitSurface } from '@sheetxl/react';

import { elevateColor } from '@sheetxl/utils-mui';

const DIVIDER_MULTI = 0.12;

// Studio's explicit cells are the escape hatch out of the derivations below. Every derived value here (the
// gridline, the header hover) is an *elevation* calculation that assumes "raised" means "lighter", which is
// the Material idea. A host with a flat design language (VS Code, Fluent) names surfaces that do not follow
// that curve, so each derivation is a fallback: a stated cell wins, and only what the host leaves unset is
// computed.

/** One cell's explicit tokens (never `undefined`, so call sites can just `?.[key] ?? <derived>`). */
const explicitFor = (
  explicit: ExplicitTokens | undefined,
  theme: Theme,
  surface: ExplicitSurface = 'app'
): Partial<TokenTheme> => explicit?.[theme.palette.mode as ThemeMode]?.[surface] ?? {};

/**
 * The studio **brand** — the handful of surface colors the studio picks for itself rather than inheriting
 * from the MUI palette. Brand lives in this adapter layer, never in `defaultTheme` (which is the UNBRANDED
 * floor for an app with no theme at all).
 *
 * @remarks
 * - `desktop` (app `color-base-200`) — behind the toolbars, around the workbook, under the status bar.
 * - `elevated` (app `color-elevated`) — menus, popups, AND the toolbar palette, which reads the same token
 *   so the overflow popup is a continuation of the bar it came from.
 * - `header` (the `header` cell's `color-base-100`) — the row/column header paper.
 *
 * Dark deliberately **inverts** MUI's convention (MUI's dark paper is *darker* than its desktop): the studio
 * wants a near-black desktop with brighter chrome floating on it. That cannot be inherited from the palette,
 * which is exactly why these are stated.
 *
 * The header entry is not optional. Under the MUI adapter the desktop and the grid body can both be
 * `background.default`, and a header that fell through to its default (the desktop — THEMING-DESIGN §4)
 * would then equal the cell fill and erase the row/column gutters.
 */
const STUDIO_BRAND: Record<ThemeMode, { desktop: string; elevated: string; header: string }> = {
  light: {
    desktop: '#f1f1f1',
    elevated: '#ffffff',
    header: '#f1f1f1'   // Excel's look: the header grey IS the desktop grey (the grid body is white)
  },
  dark: {
    desktop: '#181818',  // near-black — the ground, not a mid grey
    elevated: '#262626', // brighter than the desktop: up is lighter, unlike MUI's dark paper
    header: '#262626'
  }
};

/** This mode's brand entry. */
const brandFor = (theme: Theme): { desktop: string; elevated: string; header: string } =>
  STUDIO_BRAND[theme.palette.mode as ThemeMode] ?? STUDIO_BRAND.light;

/**
 * The header paper actually in force for a mode — the host's explicit header cell if it stated one, else the
 * studio brand. Pulled out because the header's own derivations (its hover step) must key off the fill that
 * will really be painted, not the one the brand would have used.
 */
const headerFillFor = (theme: Theme, explicit?: ExplicitTokens): string =>
  explicitFor(explicit, theme, 'header')['color-base-100'] ?? brandFor(theme).header;

/**
 * The MUI→Theme adapter: maps a MUI {@link Theme} onto the framework-neutral flat {@link TokenTheme}
 * token set (utils-react) — one mode's worth of `--sxl-*` values. {@link createStudioThemeCSS} compiles the
 * app + surface cells for both modes into the attribute-rule stylesheet the studio injects at its root, so
 * the grid resolves its palette through the token model instead of prop-threaded `GridStyle` structs.
 *
 * Only the neutral token layer is mapped here (base ramp, semantic hues, fonts, geometry). The document
 * color/font layers (`--sxl-doc-*`, `--sxl-sys-color-*`) stay with the workbook model, not the MUI theme.
 */
export const createThemeFromMUITheme = (muiTheme: Theme, explicit?: ExplicitTokens): TokenTheme => {
  const { palette, typography, shape } = muiTheme;
  const radius = typeof shape?.borderRadius === 'number' ? shape.borderRadius : 4;
  const own = explicitFor(explicit, muiTheme);
  const brand = brandFor(muiTheme);
  return {
    // Neutral surface ramp: paper → recessed/desktop → gridline, plus on-surface text. `base-200` is the
    // studio "desktop" (behind the toolbars / around the workbook, under the status bar) — a stated brand
    // grey, not a palette slot. (Menus/popups take `color-elevated`, so this doesn't grey them.)
    'color-base-100': palette.background.paper,
    'color-base-200': brand.desktop,
    'color-base-300': palette.divider,
    'color-base-content': palette.text.primary,
    // `color-base-border` — the seam framing the grid body — is deliberately NOT mapped. It looks like it
    // wants `palette.divider`, but that slot is already `base-300` above, and MUI's divider is a faint
    // hairline between list rows (0.12 alpha) while this token carries STRUCTURE and must read stronger.
    // Sourcing both from it emits one value for two tokens and drops the frame to less than half the
    // strength it is tuned at (0.26 light / 0.30 dark). It cannot be derived from divider either: `alpha()`
    // REPLACES the channel rather than scaling it, so strengthening MUI's translucent divider would weaken
    // an opaque one. MUI has no slot for a structural frame, so the token keeps its authored value and a
    // host that has one states the cell explicitly (`ExplicitTokens` is spread last — see below).
    // The field surface — the paper the fields already sat on, so the stock studio is unchanged.
    'color-input': own['color-input'] ?? palette.background.paper,
    // The floating-container fill — menus, popups, and the toolbar palette that reads the same token. Also
    // brand: MUI would hand us `background.paper`, which in dark is DARKER than the desktop above.
    'color-elevated': own['color-elevated'] ?? brand.elevated,
    // The field border is NOT MUI-derived, for the same reason `color-base-border` above isn't:
    // `palette.divider` is a faint hairline between list rows (0.12 alpha), while this one draws the EDGE of
    // a control and has to read as one. Sourcing it from divider looks like an improvement over the call
    // sites' old `alpha(divider, 0.2)` — but `alpha()` REPLACES the channel rather than scaling it, so on
    // MUI's own translucent divider that expression already resolved to 0.2, and "full strength divider"
    // silently dropped the formula bar / name box border to 0.12. Faint on dark, invisible on light paper.
    // So the token keeps its authored strength and a host with a real border color states the cell.
    ...(own['color-input-border'] ? { 'color-input-border': own['color-input-border'] } : undefined),
    // Hovered/selected row overlay — MUI's purpose-built translucent "selected" action tint (stronger than
    // `action.hover`, so a dropdown row reads clearly on the `base-100` paper). `font-family-mono` isn't
    // MUI-derived, so it rides the `defaultTheme` baseline (merged under this adapter).
    'color-base-hover': palette.action.selected,
    // MUI has no first-class "accent"; secondary is its nearest analogue (the grid doesn't paint accent).
    'color-accent': palette.secondary.main,
    'color-accent-content': palette.secondary.contrastText,
    // Semantic hues — selection/interaction reads `--sxl-color-primary`, so this is what unwires the
    // deliberate green fallback once injected.
    'color-primary': palette.primary.main,
    'color-primary-content': palette.primary.contrastText,
    'color-info': palette.info.main,
    'color-info-content': palette.info.contrastText,
    'color-success': palette.success.main,
    'color-success-content': palette.success.contrastText,
    'color-warning': palette.warning.main,
    'color-warning-content': palette.warning.contrastText,
    'color-error': palette.error.main,
    'color-error-content': palette.error.contrastText,
    // Mid neutral + ambient shadow (were `--sxl-app-color-grey` / `-shadow`).
    'color-neutral': palette.grey[500],
    'color-shadow': defaultTheme[palette.mode as ThemeMode]['color-shadow'],
    // Chrome typography (the document's own fonts are the separate `--sxl-doc-font-*` layer).
    'font-family': typography.fontFamily,
    'font-size': `${typography.fontSize}px`,
    'font-weight': String(typography.fontWeightRegular ?? 400),
    'font-style': 'normal',
    // Geometry — MUI exposes a single `borderRadius`; `box` is the slightly-rounder container radius.
    'radius-field': `${radius}px`,
    'radius-box': `${radius * 1.5}px`,
    'border': '1px'
  };
};

/**
 * The **inverse** adapter (`sxl → mui`): map a partial {@link TokenTheme} (the host's `app`
 * tokens) onto the MUI palette/geometry slots the forward {@link createThemeFromMUITheme} reads. Studio
 * merges the result INTO its `createExhibitTheme` input, so a token override flows `sxl → mui → sxl`: the MUI
 * chrome (buttons / slider / tabs) follows it as well as the grid — no "half-themed" mixed bag. Only the mapped
 * subset (colors, radius, fonts) crosses; non-color MUI config (components / spacing) is untouched. Partial in,
 * partial out — only slots whose token is present are emitted.
 */
export const tokensToMuiOptions = (tokens?: Partial<TokenTheme>): ThemeOptions => {
  if (!tokens) return {};
  const palette: Record<string, any> = {};
  const setColor = (slot: string, main?: string, contrastText?: string): void => {
    if (main == null && contrastText == null) return;
    palette[slot] = { ...(palette[slot] ?? {}) };
    if (main != null) palette[slot].main = main;
    if (contrastText != null) palette[slot].contrastText = contrastText;
  };
  setColor('primary', tokens['color-primary'], tokens['color-primary-content']);
  setColor('secondary', tokens['color-accent'], tokens['color-accent-content']);
  setColor('info', tokens['color-info'], tokens['color-info-content']);
  setColor('success', tokens['color-success'], tokens['color-success-content']);
  setColor('warning', tokens['color-warning'], tokens['color-warning-content']);
  setColor('error', tokens['color-error'], tokens['color-error-content']);

  const background: Record<string, string> = {};
  if (tokens['color-base-100'] != null) background.paper = tokens['color-base-100'];
  if (tokens['color-base-200'] != null) background.default = tokens['color-base-200'];
  if (Object.keys(background).length) palette.background = background;
  if (tokens['color-base-content'] != null) palette.text = { primary: tokens['color-base-content'] };
  if (tokens['color-base-300'] != null) palette.divider = tokens['color-base-300'];

  const options: ThemeOptions = {};
  if (Object.keys(palette).length) options.palette = palette as ThemeOptions['palette'];
  if (tokens['radius-field'] != null) options.shape = { borderRadius: parseFloat(tokens['radius-field']) };
  const typography: Record<string, any> = {};
  if (tokens['font-family'] != null) typography.fontFamily = tokens['font-family'];
  if (tokens['font-size'] != null) typography.fontSize = parseFloat(tokens['font-size']);
  if (Object.keys(typography).length) options.typography = typography;
  return options;
};

/**
 * The `grid`-surface token overrides for one mode, derived **directly** from the MUI theme
 * (paper/text plus the elevate/divider math for gridlines). A container opts into this cell by
 * setting `data-sxl-theme-surface="grid"`.
 */
const gridSurfaceTokens = (theme: Theme, explicit?: ExplicitTokens): Partial<TokenTheme> => {
  const p = theme.palette;
  const fill = p.background.default;
  return {
    'color-base-100': fill,
    'color-base-content': p.text.primary,
    'color-base-300': elevateColor(fill, DIVIDER_MULTI, p.mode),   // gridline
    'color-primary': p.primary.main,                               // selection
    ...explicitFor(explicit, theme, 'grid')
  };
};

/**
 * The `header`-surface token overrides for one mode.
 *
 * @remarks
 * The paper is the {@link STUDIO_BRAND} header grey (or the host's, if it stated the header cell) — a
 * *picked* value, not a derivation. The old `elevateColor(bodyFill, .055)` step produced mediocre greys and
 * inverted the dependency: the desktop chased a header derivation. Now the header cell is what defaults to
 * the desktop (THEMING-DESIGN §4), and both first-party clients state it instead.
 *
 * Deliberately emits no `color-base-200`: on every surface `base-200` means the recessed ground, and the
 * header simply doesn't restate it, so it inherits the app desktop. (Header *hover* is `color-base-hover` —
 * an interaction state, not a step on the depth ramp.) Its step is taken off the fill actually in force, so
 * a host-stated header still gets a hover that reads against it.
 */
const headerSurfaceTokens = (theme: Theme, explicit?: ExplicitTokens): Partial<TokenTheme> => {
  const p = theme.palette;
  const bodyFill = p.background.default;
  const headerFill = headerFillFor(theme, explicit);
  return {
    'color-base-100': headerFill,
    'color-base-hover': elevateColor(headerFill, .065, p.mode),
    'color-base-300': elevateColor(bodyFill, DIVIDER_MULTI, p.mode), // divider / edge
    'color-base-content': p.text.primary,
    'color-primary': p.primary.main,                                 // headerSelect stroke
    'color-primary-content': p.primary.contrastText,                 // headerSelectAll text
    // Select-all header text. The app baseline authors this per mode against the muted `base-emphasis`
    // fill and lands on `base-content` in light — readable, but on a header it reads as an unpainted
    // label rather than a selected one. A header states the INVERTED text in both modes, so a fully
    // selected band looks the same way light and dark. (Dark already resolved here via
    // `primary-content`; this only moves light.)
    'color-base-emphasis-content': p.primary.contrastText,
    ...explicitFor(explicit, theme, 'header')
  };
};

/**
 * The studio's theme stylesheet: the `(token × surface × mode)` matrix as attribute rules. Emits the app
 * baseline (from the MUI adapter) for both modes plus the `grid`/`header` surface overrides (derived from the
 * same MUI themes), so a container selects its cell purely by setting `data-sxl-theme-mode` /
 * `data-sxl-theme-surface`. Inject once at the studio root; stable across the light/dark toggle (both modes
 * are always present).
 *
 * `explicit` is the host's own token values ({@link ExplicitTokens}), addressed per `(surface × mode)` cell.
 * Each cell is merged into the surface it names AND consulted by that surface's derivations, so a host color
 * participates in the math instead of being computed over. This is emitted in `sxl-app`, not
 * `sxl-overrides`, which is why it can be surface-aware: an override-layer rule keyed on `[mode]` alone
 * outranks (by layer, not specificity) the `[mode][surface="header"]` rules below, so it would flatten every
 * surface at once.
 */
export const createStudioThemeCSS = (
  lightTheme: Theme,
  darkTheme: Theme,
  scope?: string,
  explicit?: ExplicitTokens
): string => {
  // The app baseline is the neutral `defaultTheme` WITH the MUI adapter's overrides on top: the adapter maps
  // only the MUI-derived tokens (base ramp, semantic hues, fonts, geometry), so any token it doesn't map —
  // notably the categorical `color-series` palette, which isn't MUI-derived — rides the neutral baseline.
  // Without this merge those tokens exist only in the grid's `sxl-defaults` scope, so app chrome OUTSIDE the
  // grid (the formula bar) can't resolve `--sxl-color-series-*` and falls back to the inherited text color.
  // The host's explicit tokens go on LAST: the adapter already consulted them for the values it derives
  // (so nothing is computed over a color the host named), and this carries through the ones it maps 1:1.
  const app: Record<ThemeMode, TokenTheme> = {
    light: { ...defaultTheme.light, ...createThemeFromMUITheme(lightTheme, explicit), ...(explicit?.light?.app ?? {}) },
    dark: { ...defaultTheme.dark, ...createThemeFromMUITheme(darkTheme, explicit), ...(explicit?.dark?.app ?? {}) }
  };
  // `sxl-app` — the app layer, above grid-react's `sxl-defaults` (injected by WorksheetElement) and below client
  // `sxl-overrides`. Layer order (not source order / specificity) decides, so these MUI values win over the
  // neutral defaults regardless of which sheet mounts first. `scope` (when set)
  // makes this a per-instance `@scope`d sheet (design §6); floats carry the studio's scope class so a
  // portaled picker still resolves it (design §7).
  //
  // The grid surface always emits a real light AND dark cell. Whether the grid shows dark ("Enable Dark
  // Grid") is decided at runtime by the grid's `data-sxl-theme-mode` attribute (`useGridColorScheme`), NOT by
  // regenerating this stylesheet — so toggling the option is a pure attribute flip, never a sheet swap.
  return buildGridThemeCSS({
    app,
    grid: { light: gridSurfaceTokens(lightTheme, explicit), dark: gridSurfaceTokens(darkTheme, explicit) },
    header: { light: headerSurfaceTokens(lightTheme, explicit), dark: headerSurfaceTokens(darkTheme, explicit) },
    layer: 'sxl-app',
    scope
  });
};
