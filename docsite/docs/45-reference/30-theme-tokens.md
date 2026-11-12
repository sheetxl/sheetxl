---
sidebar_position: 30
title: Theme Tokens
---

Every color, font, and size SheetXL's UI reads, as a CSS variable. Set them with the `tokens` prop or in a
stylesheet; [Theme the Spreadsheet](../40-how-tos/35-theme-the-spreadsheet.md) shows how, and how to aim one
at a single mode or surface.

In CSS, each token is prefixed with `--sxl-`: `color-primary` is `--sxl-color-primary`. Any of them can be set per mode
(light, dark) and per surface (app, header, grid).

### Surfaces and text

| Token | Meaning |
| --- | --- |
| `color-base-100` | Paper: the main background |
| `color-base-200` | The backdrop around the grid; a subtle fill |
| `color-base-300` | Gridlines and dividers |
| `color-base-border` | Borders between regions: the grid frame, the line under the headers, above the tabs |
| `color-base-content` | Text on any base color |
| `color-base-hover` | A hovered row or button (keep it see-through, it sits on top of the paper) |
| `color-base-selected` / `color-base-selected-content` | A selected row or column header, list row, or tab, and its text |
| `color-base-emphasis` / `color-base-emphasis-content` | A fully selected row or column (select-all), and its text |
| `color-input` / `color-input-border` | Text fields (the formula bar, the name box) and their border |
| `color-elevated` / `color-elevated-border` | Popups and menus, and an optional border for them |

### Colors

| Token | Meaning |
| --- | --- |
| `color-primary` / `color-primary-content` | Selection and interaction, and text on it |
| `color-accent` / `color-accent-content` | A second accent, and text on it |
| `color-info` / `color-info-content` | Information |
| `color-success` / `color-success-content` | Success |
| `color-warning` / `color-warning-content` | Warning |
| `color-error` / `color-error-content` | Error |
| `color-neutral` | A muted grey for icons and quiet marks |
| `color-shadow` | Shadow color |

### Color lists

These come as numbered variables. The count is fixed: you can change the colors, not how many there are.

| Token | Variables | Meaning |
| --- | --- | --- |
| `color-series` | `--sxl-color-series-1` … `-7` | Distinct colors for things that need telling apart: cell references in a formula, and their outlines on the grid |
| `color-bracket` | `--sxl-color-bracket-1` … `-3` | Matching bracket pairs in a formula, by how deeply they're nested |

In the `tokens` prop, a list is an array: `'color-series': ['#1a73e8', '#d93025', …]`.

### Type and shape

| Token | Meaning |
| --- | --- |
| `font-family` | The chrome's font (not the cells' — see [Fonts](../40-how-tos/35-theme-the-spreadsheet.md#fonts)) |
| `font-family-mono` | Monospace text, such as function signatures in tips |
| `font-size` / `font-weight` / `font-style` | The chrome's text |
| `radius-field` / `radius-box` | Corner rounding for fields, and for boxes and panels |
| `border` | Default border width |
| `image-background` | A faint wash behind pictures and charts in dark mode |

### Stacking (advanced)

| Token | Meaning |
| --- | --- |
| `z-grid` / `z-popup` / `z-tooltip` | The `z-index` bands for things anchored to the grid, popups and menus, and tooltips. Change these only if SheetXL's popups appear behind your own UI. |

