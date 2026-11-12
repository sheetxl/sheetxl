---
sidebar_position: 35
title: Theme the Spreadsheet
---

Want the spreadsheet to look like it belongs on your page? Same background, same brand color, light and
dark that follow your site? That's what this page is for.

You don't need to learn a theming API. SheetXL's colors are plain **CSS variables** (the
`--something: value` kind), and you change them the way you'd change any CSS variable. There's also a
`tokens` prop if you'd rather stay in React.

## The 30-second version

Here's a chromeless workbook that follows your page into dark mode and matches a navy card:

```tsx
import { WorkbookElement } from '@sheetxl/react';

const TOKENS = {
  dark: {
    app: { 'color-base-100': '#14102c', 'color-base-200': '#14102c', 'color-primary': '#6e9bff' },
    header: { 'color-base-100': '#1a1538', 'color-base-300': '#312b55' }
  }
};

<WorkbookElement
  colorScheme="auto"
  gridColorScheme="auto"
  tokens={TOKENS}
/>
```

That's it. The rest of the page explains what each piece does, so you can pick your own colors.

:::tip
Define `TOKENS` outside your component (or in a `useMemo`). A new object on every render rebuilds the
stylesheet every render.
:::

## Step 1: Pick light, dark, or "follow the page"

Two props decide the mode:

| Prop | What it controls | Values |
| --- | --- | --- |
| `colorScheme` | The chrome: sheet tabs, scrollbars, the area around the grid | `'light'`, `'dark'`, `'auto'` |
| `gridColorScheme` | The cells themselves | `'light'`, `'dark'`, `'auto'` |

`'auto'` follows your page. If `<html>` or `<body>` has a `dark` or `light` class, SheetXL uses that.
Otherwise it follows the operating system's setting.

Why two props? Because a **light grid in a dark app** is normal. A spreadsheet is a document, and lots of
people want it to look the way it will print. So if you only set `colorScheme="dark"`, the cells stay light.
Set `gridColorScheme` too when you want the cells to go dark with everything else.

:::note
Leave `colorScheme` unset and the chrome is light, unless your page has a `dark` class or the user has
picked dark in SheetXL's appearance setting. Leave `gridColorScheme` unset and the cells stay light even
then, unless the user has turned on *Enable Dark Grid*.
:::

## Step 2: Know which color paints what

SheetXL's colors are called **tokens**. Each one is a CSS variable named `--sxl-<token>`, so the token
`color-primary` is the variable `--sxl-color-primary`.

Here are the ones you'll touch to match a page:

| Token | What you'll see it paint |
| --- | --- |
| `color-base-100` | Paper: the cells' background, and the headers' background |
| `color-base-200` | The backdrop around the grid (behind the scrollbars, in the corner) |
| `color-base-300` | Gridlines, and the dividers between header cells |
| `color-base-border` | The frame around the grid, and the line between the headers and the cells |
| `color-base-content` | Text |
| `color-primary` | The selection, plus scrollbar thumbs on hover |
| `color-accent` | Shape handles, comment-thread marks, and other small accents |

Scrollbars don't have their own tokens. They're mixed from `color-base-content` and `color-primary`, so
they match automatically.

The full list is in [Theme Tokens](../45-reference/30-theme-tokens.md).

## Step 3: Say which part you mean (app, header, or grid)

Here's the one idea worth learning. The workbook has three **surfaces**, which are just regions that can
each have their own colors:

- **`app`**: the chrome around everything. This is the default.
- **`header`**: the row and column headers.
- **`grid`**: the cells.

A color you set on `app` applies to **all three**. Set the same token on `header` or `grid` to make that
part different.

So in the 30-second example:

- `app` sets the paper to navy everywhere (cells, headers, chrome).
- `header` then makes the headers a touch lighter, with their own dividers, so they still stand out
  from the cells.

:::tip
Matching a card? Set `color-base-100` and `color-base-200` on `app` to the card's color, then give `header`
a slightly different `color-base-100`. Without that, the headers blend right into the cells.
:::

## Prefer CSS? Same thing, as a stylesheet

Everything the `tokens` prop does, you can do in a stylesheet. This is the same theme as the 30-second
example:

```css
@layer sxl-overrides {
  [data-sxl-theme-mode="dark"] {
    --sxl-color-base-100: #14102c;
    --sxl-color-base-200: #14102c;
    --sxl-color-primary: #6e9bff;
  }
  [data-sxl-theme-mode="dark"][data-sxl-theme-surface="header"] {
    --sxl-color-base-100: #1a1538;
    --sxl-color-base-300: #312b55;
  }
}
```

How to read it:

- `[data-sxl-theme-mode="dark"]` means "in dark mode". That's the `app` cell, so it reaches every surface.
- Add `[data-sxl-theme-surface="header"]` (or `"grid"`) to target one surface.
- Write a `light` block the same way for light mode.

You still pass `colorScheme` / `gridColorScheme` on the component. The stylesheet only supplies colors.

:::info Why `@layer sxl-overrides`?
It's the layer SheetXL reads overrides from, and it always beats SheetXL's defaults. You don't have to
worry about load order or specificity: it works wherever your stylesheet sits on the page. (Plain CSS
outside any layer also wins, if your setup prefers that.)
:::

:::warning Don't use inline styles for this
`style={{ '--sxl-color-primary': 'red' }}` on a wrapper looks like it should work, but it doesn't. The
headers and grid set their own values on themselves, so they quietly ignore yours. Use the `tokens` prop or
a stylesheet.
:::

### Which one should I use?

- **The `tokens` prop** if your colors live in React (a theme object, user settings). It only affects that
  one workbook, so two workbooks on a page can look different.
- **A stylesheet** if your site's theme already lives in CSS. It affects every SheetXL workbook on the page.

## Using Studio (the full UI)?

`Studio` is built on Material UI (MUI), so you have three options:

| Option | What it changes |
| --- | --- |
| `muiTheme` prop | Your MUI theme. Studio maps its palette onto the tokens, so the toolbar **and** the grid follow. |
| `tokens` prop | Same shape as above. `app` values recolor the MUI chrome too (buttons, slider, tabs). |
| A stylesheet | Reaches the grid, but **not** MUI's components, since MUI reads its colors in JavaScript. |

One difference from `WorkbookElement`: in Studio, an `app` value doesn't flatten the headers and grid.
Studio works out header and gridline colors from your colors, so you rarely need to set `header` or `grid`
at all.

Light and dark in Studio follow the user's appearance setting (the button in the corner), not a prop.

## Restyling the little corner marks

Cells can show small triangles in their corners: a note, a comment thread, an error check, an invalid
value. Each one has a class, so you can recolor one kind without touching anything else:

```css
.sxl-cell-mark-note { fill: hotpink; }
```

| Class | The mark |
| --- | --- |
| `sxl-cell-mark` | Every corner mark |
| `sxl-cell-mark-note` | A note (top right) |
| `sxl-cell-mark-thread` | A comment thread (top right) |
| `sxl-cell-mark-resolved` | A resolved thread (top right) |
| `sxl-cell-mark-error` | An error-check flag (top left) |
| `sxl-cell-mark-invalid` | A value that fails data validation (bottom right) |
| `sxl-cell-mark-invalid-stop` / `-warning` / `-information` / `-failed` | The same, by alert style |

## A few dark-mode things you'll notice

- **Popups lift by color, not shadow.** On a near-black background a shadow has nothing darker to show
  against, so menus and popups use a lighter fill (`color-elevated`) to stand out.
- **Shadows** use `color-shadow`. In dark it's a dark shadow, so it shows mainly at the edge of a
  lighter popup.
- **Pictures** can be inverted in a dark grid. That's a user setting (*Enable Dark Images*), not a token.

## Fonts

`font-family` sets the font of the chrome (sheet tabs, menus, popups). The cells and the row and column
headers use the **workbook's** font instead, the one saved in the file, so a spreadsheet looks the same
everywhere it's opened.

## Building your own shell

If you put your own chrome *around* `WorkbookElement` (a toolbar, a side panel) and want it to read the
same tokens, make that shell a theme root:

```tsx
import { useId } from 'react';
import { createThemeScopeClass } from '@sheetxl/utils-react';
import { ThemeRootStyles, WorkbookElement } from '@sheetxl/react';

function MyShell() {
  const scopeClass = createThemeScopeClass('shell', useId());
  return (
    <div className={scopeClass} data-sxl-theme-mode="dark">
      <ThemeRootStyles scopeClass={scopeClass} tokens={TOKENS} />
      <MyToolbar />
      <WorkbookElement colorScheme="dark" gridColorScheme="dark" tokens={TOKENS} />
    </div>
  );
}
```

`data-sxl-theme-mode` on the root is required. It's how everything inside knows which mode it's in.

## Using the tokens in your own components

Inside a themed area, read any token with plain CSS:

```css
.my-button {
  background: var(--sxl-color-base-100);
  color: var(--sxl-color-base-content);
  border: 1px solid var(--sxl-color-base-border);
}
.my-button:hover { background: var(--sxl-color-base-hover); }
```

You never check for light or dark yourself. The variable already has the right value for wherever your
element sits.

Need a real color value in JavaScript, for a `<canvas>` for example? `resolveToken(element, name)` and
`resolveTokens(element, names)` from `@sheetxl/utils-react` read it off a live element.

## The document's own colors aren't part of the theme

A workbook file carries its own colors: cell fills, font colors, and the file's theme (the accent colors
you pick in Excel's *Page Layout* tab). Those are **content**, so your theme never changes them. A file
keeps the colors it was saved with.

The exception is cells that say "use the system color", such as *window* or *window text*. Those follow
SheetXL, so they pick up the paper and text color of whatever surface they're on.

## How it works (if you're curious)

You don't need this to theme SheetXL, but it explains the rules above.

- **Everything is a CSS variable.** Components read `var(--sxl-…)`, never a JavaScript theme object, so
  there's no theme context to wire up.
- **Two attributes pick the value.** Every themed region carries `data-sxl-theme-mode` and
  `data-sxl-theme-surface`. SheetXL's stylesheet has one rule per mode and surface, and the browser picks
  the one that matches. That's why the cells and headers can differ, and why a light grid can sit inside a
  dark app.
- **Three cascade layers**, lowest to highest: `sxl-defaults` (SheetXL's neutral defaults), `sxl-app` (what
  Studio derives from your MUI theme), `sxl-overrides` (you). SheetXL declares that order before any other
  stylesheet, so your overrides always win. If you declare your own layer order, keep those three in that
  order.
- **Each workbook is scoped.** Its styles only apply inside it, so two workbooks on a page don't fight.
  Popups carry their workbook's theme with them, even though they're rendered elsewhere in the page.
