import { type TokenTheme, type ThemeMode } from './TokenTheme';
import { Z_INDEX } from './zIndex';

/**
 * The length of the categorical `color-series` palette (the `--sxl-color-series-1..N` ramp). **Fixed** — like
 * MUI's grey ramp, this is a constant the whole system agrees on, never a tunable. A client may swap the seven
 * hues (replace the `color-series` array), but never the count. Consumers rotate with `i % SERIES_COUNT`.
 */
export const SERIES_COUNT = 7;

/**
 * The length of the `color-bracket` palette (`--sxl-color-bracket-1..N`), the hues matched bracket pairs
 * cycle through by nesting depth. Fixed, like {@link SERIES_COUNT}. Consumers rotate with
 * `depth % BRACKET_COUNT`.
 */
export const BRACKET_COUNT = 3;

/**
 * The default theme — the framework-neutral, **unbranded** baseline (per mode) every surface inherits.
 * The floor for an app with no theme at all; a themed app (MUI, VS Code, …) injects its own palette over
 * it, and branding is expressed in THAT layer, never here. Grid/header surfaces (in grid-react) layer
 * their overrides on top of this.
 */
export const defaultTheme: Record<ThemeMode, TokenTheme> = {
  light: {
    'color-base-100': '#ffffff',
    'color-base-200': '#f5f5f5',
    'color-base-300': '#e0e0e0',
    'color-base-content': 'rgba(0, 0, 0, 0.87)',
    // The ground's border (grid frame, status-bar rule). Translucent, and a step STRONGER than `base-300`
    // — that one is a faint fill/gridline, this one carries structure. Same reasoning as `input-border`.
    'color-base-border': 'rgba(0, 0, 0, 0.26)',
    'color-base-hover': 'rgba(0, 0, 0, 0.08)',   // hovered/selected row overlay (translucent, composes)
    // Selected state. A pale tint is enough on a light surface, and the accent-colored text carries it.
    'color-base-selected': 'color-mix(in srgb, var(--sxl-color-primary, #1976d2) 20%, transparent)',
    'color-base-selected-content': 'var(--sxl-color-primary, #1976d2)',
    // Emphatic selection (select-all). Fill unchanged from the value the call site hardcoded; the CONTENT
    // is what was wrong — white on this muted blue is 3.17:1, while the on-surface text is 6.63:1.
    'color-base-emphasis': 'color-mix(in srgb, var(--sxl-color-primary, #1976d2) 75%, var(--sxl-color-base-100, #f5f5f5))',
    'color-base-emphasis-content': 'var(--sxl-color-base-content, rgba(0, 0, 0, 0.87))',
    'color-input': '#ffffff',                    // field surface (formula bar / name box / text fields)
    'color-input-border': 'rgba(0, 0, 0, 0.2)',  // translucent: composes over whichever surface a field sits on
    'color-elevated': '#ffffff',                 // floating container fill (popups, menus) — must be opaque
    'color-elevated-border': 'transparent',      // Material raises with the wash, not a border — hosts opt in
    'color-accent': 'rgb(33, 115, 70)',          // Excel green
    'color-accent-content': '#ffffff',           // inner ring / knob (flips with mode)
    'color-primary': '#1976d2',
    'color-primary-content': '#ffffff',
    'color-info': '#0288d1',
    'color-info-content': '#ffffff',
    'color-success': '#2e7d32',
    'color-success-content': '#ffffff',
    'color-warning': '#ed6c02',                  // remove-drag
    'color-warning-content': '#ffffff',
    'color-error': '#d32f2f',
    'color-error-content': '#ffffff',
    'color-neutral': '#9e9e9e',                  // mid grey (was --sxl-app-color-grey)
    'color-shadow': 'rgba(0, 0, 0, 0.12)',       // ambient shadow
    // categorical rainbow (7 hues, tuned for a light surface) — SERIES_COUNT long, rotated by index
    'color-series': [
      '#1a73e8', // blue
      '#d93025', // red
      '#1e8e3e', // green
      '#9334e6', // purple
      '#e37400', // orange
      '#12a4af', // cyan
      '#d01884'  // pink
    ],
    // bracket pairs by nesting depth — BRACKET_COUNT long; kept apart from the series, which colors references
    'color-bracket': ['#0431fa', '#319331', '#7b3814'],
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    'font-family-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-size': '13px',
    'font-weight': '400',
    'font-style': 'normal',
    'radius-field': '4px',
    'radius-box': '6px',
    'border': '1px',
    'z-grid': String(Z_INDEX.grid),
    'z-popup': String(Z_INDEX.popup),
    'z-tooltip': String(Z_INDEX.tooltip),
    'image-background': 'none'                    // light: no placeholder wash
  },
  dark: {
    'color-base-100': '#121212',
    'color-base-200': '#1e1e1e',
    'color-base-300': '#2e2e2e',
    'color-base-content': 'rgba(255, 255, 255, 0.87)',
    // See light. Dark carries a touch more alpha: a light hairline loses more contrast against a near-black
    // ground than a dark one does against paper.
    'color-base-border': 'rgba(255, 255, 255, 0.30)',
    'color-base-hover': 'rgba(255, 255, 255, 0.10)', // hovered/selected row overlay (translucent, composes)
    // Dark needs a STRONGER tint: the same 20% of a mid accent over a near-black surface lands within a
    // few units of that surface. Here the fill carries the state, so the text just has to be readable on
    // it — the accent as text over a 40% accent tint is barely 2.6:1.
    'color-base-selected': 'color-mix(in srgb, var(--sxl-color-primary, #90caf9) 40%, transparent)',
    // A near-white carrying a hint of the accent, NOT `base-content`. Borrowing the body text assumed a
    // near-white one; a host whose text is a dimmer grey (VS Code's `--vscode-foreground` is `#cccccc`)
    // then lands mid-grey on a mid-blue — legible at ~5:1, but it reads as unpainted rather than selected,
    // and it is the one state that drops contrast against its own unselected neighbors (8.6:1 → 5.1:1).
    // Light says "selected" with accent-colored text; this is dark's equivalent, mode-corrected — the
    // accent itself can't be the text here (2.6:1 on the fill), so the mix runs toward white instead.
    'color-base-selected-content': 'color-mix(in srgb, var(--sxl-color-primary, #90caf9) 20%, #ffffff)',
    // Same fill. Dark's content was ALREADY right by luck (`primary-content` resolves dark against a light
    // accent, 4.88:1) — but stated here rather than left to MUI's computation, which is only correct while
    // the fill happens to be near-pure accent. `base-content` here would be 2.34:1.
    'color-base-emphasis': 'color-mix(in srgb, var(--sxl-color-primary, #90caf9) 75%, var(--sxl-color-base-100, #121212))',
    'color-base-emphasis-content': 'var(--sxl-color-primary-content, rgba(0, 0, 0, 0.87))',
    'color-input': '#121212',                        // field surface (formula bar / name box / text fields)
    'color-input-border': 'rgba(255, 255, 255, 0.2)', // translucent: composes over whichever surface a field sits on
    'color-elevated': '#262626',                      // floating container fill (popups, menus): lighter than the paper, since a shadow cannot show on a dark ground — must be opaque
    'color-elevated-border': 'transparent',           // Material raises with the wash, not a border — hosts opt in
    'color-accent': 'rgb(56, 161, 105)',         // brighter green for dark
    'color-accent-content': '#0a0a0a',
    'color-primary': '#90caf9',
    'color-primary-content': '#0a0a0a',
    'color-info': '#29b6f6',
    'color-info-content': '#0a0a0a',
    'color-success': '#66bb6a',
    'color-success-content': '#0a0a0a',
    'color-warning': '#ffa726',
    'color-warning-content': '#0a0a0a',
    'color-error': '#f44336',
    'color-error-content': '#0a0a0a',
    'color-neutral': '#9e9e9e',                  // mid grey (was --sxl-app-color-grey)
    'color-shadow': 'rgba(0, 0, 0, 0.5)',        // ambient shadow: darker than light's, to read on a dark surface
    // categorical rainbow — same hues lightened/de-saturated to hold contrast on a dark surface
    'color-series': [
      '#8ab4f8', // blue
      '#f28b82', // red
      '#81c995', // green
      '#d7aefb', // purple
      '#fcad70', // orange
      '#78d9ec', // cyan
      '#ff8bcb'  // pink
    ],
    'color-bracket': ['#ffd700', '#da70d6', '#179fff'],
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    'font-family-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-size': '13px',
    'font-weight': '400',
    'font-style': 'normal',
    'radius-field': '4px',
    'radius-box': '6px',
    'border': '1px',
    'z-grid': String(Z_INDEX.grid),
    'z-popup': String(Z_INDEX.popup),
    'z-tooltip': String(Z_INDEX.tooltip),
    // dark: a faint light wash behind image placeholders/frames so they read on the dark surface
    'image-background': 'linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10))'
  }
};
