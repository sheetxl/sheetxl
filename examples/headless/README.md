# SheetXL — Headless examples

A small collection of **headless** (Node, no UI) examples that build spreadsheets
with the [`@sheetxl/sdk`](../../packages/sdk) and write them to disk via
[`@sheetxl/io`](../../packages/io).

There is no browser, no React and no MUI here — just the SDK. Use these as a
starting point for server-side report generation, batch jobs or CLI tooling.

## Examples

| Script | What it demonstrates |
| --- | --- |
| [`src/readinglog.ts`](src/readinglog.ts) | A styled "Book Reading Log" — sheet/workbook creation, the row-cursor pattern, formulas via `getAddress()`, range-level styling, the `setBold()` / `setItalic()` font helpers, and writing both `.xlsx` and `.sxl`. |

## Run

```bash
pnpm install
pnpm --filter example-headless start
```

Output is written to [`./output`](./output) (`reading-log.xlsx` and `reading-log.sxl`).

The scripts run with [`tsx`](https://tsx.is) against the **built** packages, so build
them first (`pnpm build`). They pass `--tsconfig ../../tsconfig.base.json` because this
folder's own `tsconfig.json` maps `@sheetxl/*` to source for type-checking, and the SDK
source does not run outside Vite (it imports a `virtual:` locale module).

## Add your own

1. Drop a new `*.ts` file in [`src`](src).
2. Add a script to [`package.json`](package.json), e.g.
   `"my-example": "tsx --tsconfig ../../tsconfig.base.json src/my-example.ts"`.
3. Run it with `pnpm --filter example-headless my-example`.
