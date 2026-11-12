/**
 * SheetXL theming — a `TokenTheme` is a **flat set of token values** (one light/dark mode's worth). The type
 * IS the CSS-variable list: each key is exactly the variable name minus the `--sxl-` prefix, so an author
 * never learns a mapping (`'color-base-100'` → `--sxl-color-base-100`, `'font-family'` → `--sxl-font-family`).
 * The generator just prepends `--sxl-`.
 *
 * A **token** is one named entry (a key); a **`TokenTheme`** is a set of their values. There is no "surface" or
 * "mode" object — those are composition: mode is a `themeVars` / `buildThemeCSS` argument, and a surface is
 * a `Partial<TokenTheme>` merged on top (grid/header surfaces live in grid-react — grid additions, not generic).
 *
 * Colors, fonts, and geometry all live here together. Document colors/fonts (`--sxl-sys-color-*`, `--sxl-doc-*`,
 * cell content) are a separate layer, not modeled here.
 *
 * ## The token test
 *
 * A key exists here **iff a host theming system would name that color**. Surfaces, interaction states, and
 * semantic hues pass — MUI names `background.paper` / `action.hover` / `palette.primary`; VS Code names
 * `input.background` / `list.hoverBackground`. *Techniques* and *app regions* fail: "elevation", a wash, a
 * toolbar, a titlebar are style choices an app composes FROM tokens, never tokens themselves. That is what
 * keeps this vocabulary mappable onto any theming system instead of duplicating one. It cuts both ways: an
 * app-level idea (a brighter toolbar, a titlebar that dims when unfocused) is expressed in the app's own
 * styles — apps are free to make such additions; they don't get to grow the vocabulary.
 *
 * ## The four categories, and which `-border` / `-content` goes with each
 *
 * | category | tokens | `-border` | `-content` |
 * | --- | --- | --- | --- |
 * | ground | `base-100/200/300`, `base-content` | yes — `base-border` | yes |
 * | role surfaces | `input`, `elevated` | yes, each its own | no — inherit `base-content` |
 * | interaction states | `base-hover`, `base-selected`, `base-emphasis` | no | `selected`/`emphasis` yes; `hover` no |
 * | semantic hues | `primary`, `info`, `success`, `warning`, `error`, `accent` | no | yes |
 *
 * - **Each opaque surface has its own `-border`.** The ground's is `base-border`; the role surfaces have
 *   `input-border` and `elevated-border`. Draw a surface's edge with the one that belongs to it. They are
 *   independent values, not shades of each other — a host can give fields a hard edge and the grid a faint
 *   one. Interaction states have none: they are translucent, so whatever is under them still shows its edge.
 * - **Fills that change the text color name their own `-content`.** Text is `base-content` by default; paint
 *   with `selected`, `emphasis`, or a semantic hue and you take that fill's `-content` for text on it.
 *   `hover` and the role surfaces have none, so `base-content` still applies — for `input` and `elevated`
 *   that is a contract, and a host must choose fills it stays readable on.
 *
 * (`neutral`, `shadow`, the categorical `series` ramp, fonts, geometry, and `image-background` sit outside
 * the surface/state system — standalone named values.)
 */
export interface TokenTheme {
  // neutral surface elevation ramp
  'color-base-100'?: string;
  'color-base-200'?: string;
  'color-base-300'?: string;
  'color-base-content'?: string;
  /**
   * The **ground's border** — what separates a ground surface from an adjacent one: the seam framing the
   * grid body, the rule above the status bar, the line the sheet tabs notch into.
   *
   * @remarks
   * Distinct from `base-300`, which is the faint gridline and the ramp's third *fill* step. This one carries
   * structure, so it is normally the stronger of the two — set both if the grid's outline should differ from
   * its gridlines.
   *
   * Hosts name this: MUI `palette.divider`, VS Code `panel.border` / `editorGroup.border` / `contrastBorder`.
   * Translucent by default, so it composes over whichever ground it lands on.
   *
   * The seam it draws is **not owned by one component**. Its segments belong to several — the sheet's grid
   * edge, the tab strip's top line and the notch the selected tab cuts into it, the scrollbar and
   * split-resizer dividers, the status bar's rule — and they must read as a single continuous line. Any of
   * them open-coding its own color is what lets the seam drift apart, so each paints from THIS token.
   *
   * A segment rendered from inside another surface (the grid edge, drawn from within the grid) declares
   * `themeSurfaceProps('app', …)` so the token resolves as chrome. That is the ordinary surface mechanism,
   * nothing specific to borders.
   */
  'color-base-border'?: string;
  // hovered/selected surface — a fill painted on top of a base surface (list rows, icon buttons). Kept
  // translucent so it composes over whichever base a control sits on, and reads a step stronger than the
  // faint `base-200` desktop grey (which is too subtle for a hover on the `base-100` paper).
  'color-base-hover'?: string;
  /**
   * The **selected** interaction state — the fill for a selected row / column header, list row, tab.
   *
   * @remarks
   * The sibling of {@link TokenTheme['color-base-hover'] color-base-hover}, and it exists for the same
   * reason: selection is an interaction *state*, and `base-100/200/300` is a depth *ramp* with no slot for
   * one. Without it, selection was open-coded at the call site as a fixed `color-mix(primary 20%,
   * transparent)` — a ratio tuned against a light surface, which collapses on a dark one (20% of a mid
   * accent over a near-black header lands within a few units of the header itself). A per-mode token lets
   * each mode carry a ratio that actually reads. Stated relative to `--sxl-color-primary`, so it still
   * follows a host's accent.
   */
  'color-base-selected'?: string;
  /** Text/iconography on {@link TokenTheme['color-base-selected'] color-base-selected}. */
  'color-base-selected-content'?: string;
  /**
   * The **emphatic** selection state — a whole row/column selected rather than touched (select-all).
   *
   * @remarks
   * A third state token rather than a reuse of `color-accent`: `accent` is a different *hue role*
   * (decoration — icon accent layers, chart series), and its `-content` means "text on the accent fill",
   * which this is not. Its own pair also fixes a broken guarantee. The call site painted a muted accent
   * (`color-mix(primary 75%, base-100)`) but took `primary-content` for text — and `primary-content` is
   * MUI's `contrastText`, *computed against pure `primary.main`*. The mute silently invalidates it: in
   * light that pairing measures 3.17:1, under AA, where MUI believed it was guaranteeing 4.60:1. Authoring
   * the content per mode against the ACTUAL fill removes the computation from the loop entirely.
   */
  'color-base-emphasis'?: string;
  /**
   * Text/iconography on {@link TokenTheme['color-base-emphasis'] color-base-emphasis}.
   *
   * @remarks
   * Authored against a *mid-luminance* muted accent, which is what the default fill resolves to in both
   * modes — so both modes want dark-ish text, and neither can be derived from the accent's own contrast
   * pairing. A host whose `primary` is unusually dark or light should state this alongside the fill.
   */
  'color-base-emphasis-content'?: string;
  /**
   * The **field** surface — the formula bar, the name box, and text inputs. A *role* token, deliberately
   * not a step of the `base-*` ramp: the ramp expresses elevation (a Material idea, where "raised" implies
   * "lighter"), while a flat design language (VS Code, Fluent) gives fields their own named color that is
   * often DARKER than the chrome around them. A host that has such a color sets this; otherwise the app
   * layer derives it from the paper surface and nothing changes.
   */
  'color-input'?: string;
  /**
   * The field border — what separates {@link TokenTheme['color-input'] color-input} from the surface it sits
   * on. Its own token (not `base-300`) for the same reason: in a flat language the field border is the ONLY
   * thing carrying the field's structure, so it must be settable at full strength and never derived by
   * multiplying a divider's alpha.
   */
  'color-input-border'?: string;
  /**
   * The fill of a **floating container** — popup panels, menus, popovers: chrome that leaves the layout
   * and covers arbitrary content. A docked region that wants to read as the same surface (the toolbar
   * palette) reads this same token; that is an app style choice, not a second token.
   *
   * @remarks
   * Must be **opaque** — it is applied as `background-color`, which replaces the surface, and there is no
   * guarantee about what it covers.
   *
   * Material gets this for free by washing the paper lighter ({@link TokenTheme['color-elevated-border']}
   * explains why that stops working in a flat host). Stating it as a token lets a host put the step back
   * deliberately, in whichever direction its language wants — lighter on dark, darker on light — instead of
   * inheriting Material's "up is lighter" assumption. Defaults to the paper surface, so unset changes nothing.
   *
   * **One step per kind, not a scale.** There is deliberately no `elevated-2` / `elevated-3`, and no
   * "elevation" token at all — elevation is a *technique*, which fails the token test above. Material needs
   * a numbered ramp because lightness is its ONLY depth signal; once depth is carried by border + shadow
   * those compose on their own (a submenu over a menu still reads), so a second *fill* buys nothing. A
   * region that wants a subtle lift rather than this fill (a titlebar) paints its own wash over whatever it
   * sits on — an app style, not a token.
   */
  'color-elevated'?: string;
  /**
   * The border on a **raised container** — popup panels, menus, the toolbar palette.
   *
   * @remarks
   * In Material, "raised" is expressed as *lightness*: these surfaces take a lighter fill
   * ({@link TokenTheme['color-elevated'] color-elevated}) and carry no border. A flat design language holds
   * the fill nearly constant and expresses it as **border + shadow** instead (VS Code's own find widget
   * and menus do exactly this), so a host whose float fill sits within a shade of the ground has to put the
   * structure back somewhere — and this is it. Defaults to `transparent`, so the Material presentation is
   * unchanged unless a host opts in.
   */
  'color-elevated-border'?: string;
  // interaction accent (selection, handles)
  'color-accent'?: string;
  'color-accent-content'?: string;
  // semantic hues — app chrome; the grid paints `color-warning` (remove-drag)
  'color-primary'?: string;
  'color-primary-content'?: string;
  'color-info'?: string;
  'color-info-content'?: string;
  'color-success'?: string;
  'color-success-content'?: string;
  'color-warning'?: string;
  'color-warning-content'?: string;
  'color-error'?: string;
  'color-error-content'?: string;
  // a mid neutral (muted foreground / borders on icons + chrome) + the ambient shadow color
  'color-neutral'?: string;
  'color-shadow'?: string;
  // categorical ("rainbow") series — a FIXED-LENGTH palette of mutually-distinct hues, rotated by index
  // (formula reference coloring, range-picker rectangles). Emitted as numbered vars `--sxl-color-series-1..N`
  // (1-based), so a consumer reads `var(--sxl-color-series-${(i % SERIES_COUNT) + 1})`. Length is the fixed
  // constant {@link SERIES_COUNT} — a client re-brands by replacing the whole array, never its length.
  'color-series'?: string[];
  // bracket pairs by nesting depth in formula text — a FIXED-LENGTH palette ({@link BRACKET_COUNT}), emitted
  // as `--sxl-color-bracket-1..N` like the series. Distinct from the series, which colors the references
  // on the same line.
  'color-bracket'?: string[];
  // chrome typography (the document's fonts are the separate `--sxl-doc-font-*`)
  'font-family'?: string;
  /** Monospace stack for code-ish chrome (the formula signature, argument names, evaluated-run tips). */
  'font-family-mono'?: string;
  'font-size'?: string;
  'font-weight'?: string;
  'font-style'?: string;
  // geometry
  'radius-field'?: string;
  'radius-box'?: string;
  'border'?: string;
  /**
   * The stacking bands floating UI sits in (`--sxl-z-grid` / `-popup` / `-tooltip`): grid-anchored floats,
   * popups + menus + modals, tooltips. See `zIndex.ts` for the order and the defaults; consumers read a
   * band through `zIndexVar` and never write a number. Mode-independent, so both modes carry the same values.
   */
  'z-grid'?: string;
  'z-popup'?: string;
  'z-tooltip'?: string;
  /**
   * The `background-image` painted behind image-bearing placeholders/frames (charts, shapes, slicers, the
   * column button) — a faint light wash over a dark surface, `none` in light. Mode-driven, so consumers just
   * read `var(--sxl-image-background)` and it follows the surface.
   *
   * @remarks
   * The sibling `--_sxl-image-filter` (dark-image invert) is deliberately NOT a token: it carries a runtime
   * preference gate (`enableDarkImages`) that a pure mode-driven token can't express — a descendant grid scope
   * would re-emit and un-gate it. It's a single workbook-root computed var instead (see WorkbookElement).
   */
  'image-background'?: string;
}

/** Light / dark selector — the one axis `themeVars` resolves; a `TokenTheme` is the values for one mode. */
export type ThemeMode = 'light' | 'dark';
