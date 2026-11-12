# Icon Path Classes & CSS Variables

This doc defines the tiny, semantic set of SVG path classes your icon packs can use, and the CSS variables your app/theme controls. It’s designed for:

- Dynamic creation of new Icons
- multiple packs with aligned keys
- SSR-friendly inline SVG

---

## Path classes (semantic, not stylistic)

Each `<path>` should have **one paint** plus **optional tone/semantics/modifiers**:

### Paint (exactly one)

- `fill` — a filled shape
- `line` — a stroked outline

### Tones (optional; default tone is “main”)

- `secondary` — second tone layer
- `tertiary` — third tone layer

### Semantics (optional tint)

- `accent` — highlighted action area (e.g., brush head)
- `success` | `info` | `warning` | `error` — status-tinted layer (use only if you need status colors on icons)

### Modifiers (optional)

- `muted` — lower opacity for this layer
- `fixed` — opt out of theming; keep the path’s authored `fill`/`stroke`
- `invert-dark` — invert this path in dark mode (for hard-coded brand colors)

> **Rule of thumb:** If you need both a fill *and* an outline, **duplicate the path**:
> one path with `fill`, one with `line`. Don’t put both on the same path.

---

## Styling model (how CSS applies)

Precedence (per-path): **defaults → tone → semantics → paint**.

- Any path starts as **main tone**.
- `secondary`/`tertiary` override color/opacity via CSS variables.
- `accent`/`success`/`info`/`warning`/`error` override **color only** (opacity stays from tone).
- `fill`/`line` consume the variables and actually paint the shape.

An **authored value on the path wins over the theme** — a path carrying its own `fill` (or `stroke`
for a `line`) keeps that color, and one carrying its own `opacity` keeps that opacity. Each opts out
independently, so a path can take the themed color at a fixed opacity:

```ts
{ d: "M…band…", className: "fill primary", opacity: "0.5" }   // themed hue, authored dimming
```

Use it for a layer whose dimming is part of the drawing (a tinted band behind a glyph), not for
per-theme dimming — that belongs in the `--icon-*-opacity` variables.

---

## CSS variables (theme controls these)

At the `.icon` wrapper:

- `--icon-size` — `font-size` for the icon (the React component also supports a `size` prop)
- `--icon-color` — main tone color (defaults to `currentColor`)
- `--icon-secondary-color` / `--icon-tertiary-color` — duotone colors
- `--icon-line-color` — default stroke color
- `--icon-primary` / `--icon-accent` / `--icon-success` / `--icon-info` / `--icon-warning` / `--icon-error` — per-layer override hooks; each defaults to the matching `--sxl-color-*` token (e.g. WalkingIcon sets `--icon-primary` to retint the walkable stroke)
- `--icon-main-opacity` / `--icon-secondary-opacity` / `--icon-tertiary-opacity` / `--icon-line-opacity`
- `--icon-stroke-em` — stroke width in `em` (scales with size)
- `--icon-filter` — optional global filter hook (e.g., glow/contrast)

Variant/weight (no new art) are done with CSS classes that set variables:

- `outlined` → main fill opacity `0`, line opacity `1`
- `filled` → main fill opacity `1`, line opacity `0`
- `weightThin` / `weightBold` → change `--icon-stroke-em`

---

## Authoring examples

### **Standard + accent**

```ts
paths: [
  { d: "M…handle…", className: "fill" },           // main
  { d: "M…brush…",  className: "accent fill" },    // highlighted area
  { d: "M…edge…",   className: "line" }            // outline
]
```
