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
- `success` | `info` | `warn` | `error` — status-tinted layer (use only if you need status colors on icons)

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
- `accent`/`success`/`info`/`warn`/`error` override **color only** (opacity stays from tone).
- `fill`/`line` consume the variables and actually paint the shape.

---

## CSS variables (theme controls these)

At the `.icon` wrapper:

- `--icon-size` — `font-size` for the icon (the React component also supports a `size` prop)
- `--icon-color` — main tone color (defaults to `currentColor`)
- `--icon-secondary-color` / `--icon-tertiary-color` — duotone colors
- `--icon-line-color` — default stroke color
- `--icon-accent` / `--icon-success` / `--icon-info` / `--icon-warn` / `--icon-error` — semantic colors
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
