import { describe, it, expect } from 'vitest';

import { defaultTheme } from '@sheetxl/utils-react';

import { buildGridThemeCSS } from '@sheetxl/grid-react';

import { createExhibitTheme } from '@sheetxl/utils-mui';

import { type ExplicitTokens } from '@sheetxl/react';

import { createStudioThemeCSS } from '../theme/ThemeUtils';

/** Pull one token's value out of the rule whose selector contains `sel`. */
const grab = (css: string, sel: string, tok: string): string => {
  for (const rule of css.split('\n')) {
    if (!rule.includes(sel)) continue;
    const m = rule.match(new RegExp(`--sxl-${tok}:([^;]+);`));
    if (m) return m[1];
  }
  return '(absent)';
};

const APP_DARK = '[data-sxl-theme-mode="dark"]{';
const HDR_DARK = '[data-sxl-theme-mode="dark"][data-sxl-theme-surface="header"]';

// The palette the VS Code webview actually hands over under Dark Modern.
const darkTheme = createExhibitTheme(true, {
  palette: {
    background: { default: '#1f1f1f', paper: '#202020' },
    text: { primary: '#cccccc', secondary: '#cccccc' },
    divider: '#313131',
    primary: { main: '#0078d4' }
  }
});
const lightTheme = createExhibitTheme(false, {});

const HOST_TOKENS: ExplicitTokens = {
  dark: {
    app: {
      'color-base-200': '#1f1f1f',        // editor.background — the app surface IS the editor pane
      'color-input': '#313131',           // input.background
      'color-input-border': '#3c3c3c',    // input.border
      'color-base-border': '#ffffff17',   // editorGroup.border — the ground's seam
      'color-elevated': 'color-mix(in srgb, #1f1f1f 94%, #cccccc 6%)', // synthesized elevation step
      'color-elevated-border': '#454545'  // menu.border
    }
  }
};

// The studio brand — the surfaces the studio picks for itself rather than inheriting from the MUI palette.
const BRAND_DESKTOP_DARK = '#181818';
const BRAND_ELEVATED_DARK = '#262626';
const BRAND_HEADER_DARK = '#262626';

describe('studio theme tokens', () => {
  it('states the brand surfaces when the host supplies nothing', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    // The desktop and the float fill are BRAND, not palette-derived: MUI would hand over `background.paper`
    // (#202020) for the float, which in dark is *darker* than the desktop — the convention the studio
    // deliberately inverts. Neither can be inherited, which is why they are stated.
    expect(grab(css, APP_DARK, 'color-base-200')).toBe(BRAND_DESKTOP_DARK);
    expect(grab(css, APP_DARK, 'color-elevated')).toBe(BRAND_ELEVATED_DARK);
    expect(grab(css, HDR_DARK, 'color-base-100')).toBe(BRAND_HEADER_DARK);
    // A MUI app injects MUI's palette where MUI HAS a slot: the field surface is the paper.
    expect(grab(css, APP_DARK, 'color-input')).toBe('#202020');
    // The field BORDER is the exception, for the same reason `color-base-border` below is. `palette.divider`
    // is a faint 0.12 hairline between list rows, while this token draws the EDGE of a control; taking it
    // drops the formula bar / name box border to less than half the strength it is tuned at. So it keeps its
    // authored value and a host with a real border color states the cell (see 'lets explicit host tokens win').
    expect(grab(css, APP_DARK, 'color-input-border')).toBe(defaultTheme.dark['color-input-border']);
    expect(grab(css, APP_DARK, 'color-input-border')).not.toBe(darkTheme.palette.divider);
    // The GROUND's border is the opposite case, and this pins it. `palette.divider` is the obvious-looking
    // source — it is MUI's only border-ish slot — but it is ALREADY `base-300`, and it is a faint 0.12
    // hairline while this token carries structure. Taking it emits one value for both tokens and drops the
    // seam framing the grid to less than half its tuned strength, which reads as a washed-out frame. So it
    // keeps its authored value here.
    expect(grab(css, APP_DARK, 'color-base-border')).toBe(defaultTheme.dark['color-base-border']);
    expect(grab(css, APP_DARK, 'color-base-border')).not.toBe(darkTheme.palette.divider);
    expect(grab(css, APP_DARK, 'color-base-border')).not.toBe(grab(css, APP_DARK, 'color-base-300'));
    // Raised containers stay border-less: Material expresses depth as the lighter fill, hosts opt into a border.
    expect(grab(css, APP_DARK, 'color-elevated-border')).toBe('transparent');
  });

  it('lets explicit host tokens win', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', HOST_TOKENS);
    expect(grab(css, APP_DARK, 'color-base-200')).toBe('#1f1f1f');
    expect(grab(css, APP_DARK, 'color-input')).toBe('#313131');
    expect(grab(css, APP_DARK, 'color-input-border')).toBe('#3c3c3c');
    expect(grab(css, APP_DARK, 'color-elevated-border')).toBe('#454545');
    // The route in for the ground's seam. It has no MUI-derived entry (see the adapter), so this is the ONLY
    // way a host moves it — the explicit cell is spread last and needs no mapping to win.
    expect(grab(css, APP_DARK, 'color-base-border')).toBe('#ffffff17');
    // A non-hex value must survive verbatim — nothing derives off `color-elevated`, and `elevateColor`
    // (which MUI's decomposeColor would throw on) must never be handed it.
    expect(grab(css, APP_DARK, 'color-elevated')).toBe('color-mix(in srgb, #1f1f1f 94%, #cccccc 6%)');
  });

  it('does NOT hand the app desktop to the headers', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', HOST_TOKENS);
    // The header cell DEFAULTS to the desktop (THEMING-DESIGN §4), but the studio always states it — and
    // that override is not optional. A host naming its desktop means "the app surface is my editor
    // background", which is also the grid body; a header that took it would paint the gutters the same
    // color as the cells and erase them.
    expect(grab(css, HDR_DARK, 'color-base-100')).toBe(BRAND_HEADER_DARK);
    expect(grab(css, HDR_DARK, 'color-base-100')).not.toBe('#1f1f1f');
  });

  it('lets a host state the header cell, and derives the hover off what it stated', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', {
      dark: { ...HOST_TOKENS.dark, header: { 'color-base-100': '#181818' } } // editorGroupHeader.tabsBackground
    });
    expect(grab(css, HDR_DARK, 'color-base-100')).toBe('#181818');
    // The one derivation left on this surface must step off the fill actually in force, not the brand's —
    // otherwise a host-stated header gets a hover tuned against a color that is no longer painted.
    // elevate(rgb(24,24,24), .065, dark) === lighten by .0975.
    expect(grab(css, HDR_DARK, 'color-base-hover')).toBe('rgb(46, 46, 46)');
  });

  it('defaults an UNSTATED header cell to the app desktop, as a value', () => {
    // The emitter resolves the default at emission time — it has both cells in hand, so the header receives
    // the app's `base-200` VALUE. A `var(--sxl-color-base-200)` would resolve against the header cell's own
    // re-declaration of that token and never mean "the desktop".
    const css = buildGridThemeCSS({
      app: { light: { 'color-base-200': '#eeeeee' }, dark: { 'color-base-200': '#181818' } },
      header: { light: {}, dark: { 'color-base-hover': '#333333' } }
    });
    expect(grab(css, HDR_DARK, 'color-base-100')).toBe('#181818');
    expect(grab(css, '[data-sxl-theme-mode="light"][data-sxl-theme-surface="header"]', 'color-base-100'))
      .toBe('#eeeeee');
  });

  it('keeps the header hover OFF the depth ramp', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    // `base-100/200/300` is paper → recessed → border. A pointer state is not a step on that scale, and
    // parking it on `base-200` made one ramp token mean something unrelated to its meaning everywhere
    // else (on the app surface `base-200` is the desktop). Hover lives on `color-base-hover`.
    // elevate(brand header rgb(38,38,38), .065, dark).
    expect(grab(css, HDR_DARK, 'color-base-hover')).toBe('rgb(59, 59, 59)');
    // Not restated here, so it INHERITS the app desktop — `base-200` means the recessed ground everywhere.
    expect(grab(css, HDR_DARK, 'color-base-200')).toBe('(absent)');
  });

  it('carries a per-mode selected tint, stronger in dark', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    const APP_LIGHT = '[data-sxl-theme-mode="light"]{';
    // Light keeps the ratio the call site used to hardcode, so nothing moves there.
    expect(grab(css, APP_LIGHT, 'color-base-selected')).toContain('20%');
    // Dark must NOT reuse it: 20% of a mid accent over a near-black header is indistinguishable from the
    // header. This is the whole point of making it per-mode rather than a constant at the call site.
    expect(grab(css, APP_DARK, 'color-base-selected')).toContain('40%');
    // Stated relative to the accent, so a host's `primary` still drives it.
    expect(grab(css, APP_DARK, 'color-base-selected')).toContain('var(--sxl-color-primary');
    // Light carries the state with accent-colored TEXT; dark carries it with the fill and needs its own
    // content color. It must not fall back to `base-content` — a host with dim body text (VS Code's
    // `#cccccc`) then paints mid-grey on the mid-blue fill, the one state that reads worse than its
    // unselected neighbours.
    expect(grab(css, APP_LIGHT, 'color-base-selected-content')).toContain('var(--sxl-color-primary');
    expect(grab(css, APP_DARK, 'color-base-selected-content')).not.toContain('base-content');
    expect(grab(css, APP_DARK, 'color-base-selected-content')).toContain('#ffffff');
  });

  it('keeps the emphasis FILL identical while authoring its content per mode', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    const APP_LIGHT = '[data-sxl-theme-mode="light"]{';
    // The fill was never the problem — it must not move in either mode.
    for (const sel of [APP_LIGHT, APP_DARK]) {
      expect(grab(css, sel, 'color-base-emphasis')).toContain('75%');
      expect(grab(css, sel, 'color-base-emphasis')).toContain('var(--sxl-color-primary');
    }
    // The content is what was broken, and the two modes genuinely need different answers: `base-content`
    // is 6.63:1 on the light fill but only 2.34:1 on the dark one. Neither can come from MUI's
    // `contrastText`, which is computed against the pure accent rather than this muted mix.
    expect(grab(css, APP_LIGHT, 'color-base-emphasis-content')).toContain('base-content');
    expect(grab(css, APP_DARK, 'color-base-emphasis-content')).toContain('primary-content');
  });

  it('inverts the select-all header label in BOTH modes', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    const HDR_LIGHT = '[data-sxl-theme-mode="light"][data-sxl-theme-surface="header"]';
    // The app baseline lands on `base-content` in light (above) — on a header that reads as an unpainted
    // label rather than a selected band. The header surface restates it as the inverted text, so a fully
    // selected column/row looks the same way in both modes.
    expect(grab(css, HDR_LIGHT, 'color-base-emphasis-content')).toBe(lightTheme.palette.primary.contrastText);
    expect(grab(css, HDR_DARK, 'color-base-emphasis-content')).toBe(darkTheme.palette.primary.contrastText);
  });

  it('injects the app layer\'s palette, not the unbranded fallback', () => {
    // The layering this guards. `defaultTheme` is the UNBRANDED floor for an app with no theme at all; a
    // themed app injects its own palette, and branding lives in that layer. So for a MUI app
    // `color-accent` must follow `palette.secondary` — including when that slot is left unset and MUI's
    // own default fills it — and must never be pulled back to the floor. (Pinned because it reads like a
    // bug from outside: the token set states a green, so seeing purple looks like a clobbered default
    // rather than the seam working. The fix for an unset slot belongs in the app's `muiTheme`.)
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    const APP_LIGHT = '[data-sxl-theme-mode="light"]{';
    expect(grab(css, APP_LIGHT, 'color-accent')).toBe(lightTheme.palette.secondary.main);
    expect(grab(css, APP_DARK, 'color-accent')).toBe(darkTheme.palette.secondary.main);
    expect(grab(css, APP_LIGHT, 'color-accent')).not.toBe(defaultTheme.light['color-accent']);
  });

  it('lets a host inject ITS colors over the framework\'s', () => {
    // The same seam one layer up: a VS Code app states VS Code's values and they win over the MUI-derived
    // ones, without either side knowing about the other.
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', {
      dark: { app: { 'color-accent': '#ffcc00' } } // editorLightBulb.foreground
    });
    expect(grab(css, APP_DARK, 'color-accent')).toBe('#ffcc00');
  });

  it('stays surface-aware: the grid keeps its own fill, unmoved by the chrome tokens', () => {
    const css = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', HOST_TOKENS);
    const gridDark = '[data-sxl-theme-mode="dark"][data-sxl-theme-surface="grid"]';
    expect(grab(css, gridDark, 'color-base-100')).toBe('#1f1f1f');
  });

  it('does not disturb the un-hosted light mode when only dark tokens are given', () => {
    const before = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x');
    const after = createStudioThemeCSS(lightTheme, darkTheme, '.studio-x', HOST_TOKENS);
    const APP_LIGHT = '[data-sxl-theme-mode="light"]{';
    expect(grab(after, APP_LIGHT, 'color-base-200')).toBe(grab(before, APP_LIGHT, 'color-base-200'));
  });
});
