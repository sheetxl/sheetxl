# SheetXL — Chromeless example

A minimal example of hosting the **chromeless** (framework-neutral) `WorkbookElement`
from [`@sheetxl/react`](../../packages/react) with **no UI framework** (no MUI).

It renders only the sheet, the frameworkless tabs and scrollbars — like a file
preview/editor pane. There is no toolbar, formula bar, status bar or menus. Use this
as a starting point when you want to embed a spreadsheet without SheetXL's MUI chrome.

For the full-featured studio (toolbar, dialogs, menus, theming) see
[`examples/studio-mui`](../studio-mui).

## What it demonstrates

- Hosting `WorkbookElement` from `@sheetxl/react` directly.
- Loading a workbook from a `?source=` URL (mirrors the studio example), e.g.
  `http://localhost:5173/?source=./loan-calculator.xlsx&title=Demo` (the workbook
  ships in `public/`, so it is fetched from wherever the example is served).
  Format readers (xlsx/csv) are registered lazily via `WorkbookIO.install`.
- Browser keyboard handling and an unsaved-changes `beforeunload` guard.
- Reflecting the workbook name into the browser tab title.

## Run

```bash
pnpm install
pnpm --filter example-chromeless dev
```
