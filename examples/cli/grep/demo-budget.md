# grep demo — budget.xlsx

Regenerate the workbook (also a runner example):

```sh
npx sheetxl -f examples/scripts/generate-budget.ts --out examples/grep/budget.xlsx
```

The workbook: a `Budget` sheet (regions, quarters, a formula `Total` column, percent
`Growth`, date `Updated`) and a `Notes` sheet of prose. One planted defect: `D4` is a
hardcoded constant where every other Total is a formula.

All commands run from `packages/cli`. The workbook is the trailing positional argument;
`--in examples/grep/budget.xlsx` is an accepted alternate spelling (they conflict-error if
both are given and differ).

## 1. Basic search — the defaults are what the grid shows, formulas, and text off the grid

```
$ sheetxl grep "West" examples/grep/budget.xlsx
grep "West" · workbook · fields display,formula,comment,shape,chart,name · 2 cells in 2 of 2 sheets
  Budget!A5  display  'West
  Notes!A2   display  'TODO: verify West Q2 numbers
```

Every match is tagged with the layer it matched. The `'` prefix marks strings —
numbers, dates, booleans and errors appear bare. The header names exactly what *was*
searched (scope and fields), so a miss is diagnosable; nothing beyond it is claimed.

The stored scalar behind a formatted cell is a separate, opt-in layer, `value` — see §4.

## 2. The outlier — grep every formula, spot the hole

```
$ sheetxl grep "=" examples/grep/budget.xlsx --fields formula
grep "=" · workbook · fields formula · 3 cells in 1 of 2 sheets
  Budget!D2  formula  =B2+C2
  Budget!D3  formula  =B3+C3
  Budget!D5  formula  =B5+C5
```

D2, D3, D5 — **D4 is missing**: a hardcoded value where a formula belongs, visible
without reading a single value.

## 3. Who references B2?

```
$ sheetxl grep "B2" examples/grep/budget.xlsx --fields formula -w
grep "B2" · workbook · fields formula · 1 cell in 1 of 2 sheets
  Budget!D2  formula  =B2+C2
```

`-w` keeps `B2` from matching inside `B20`-style refs — and text edges count as
boundaries, so `-w` also works on patterns like `$1,234` that start on a non-word
character. Formula text is per-cell A1, so dependency questions work cell-by-cell.

## 4. display vs value — the same cell, two texts

B2 stores `1234.5678`, formatted `#,##0.00`:

```
$ sheetxl grep "1,234.57" examples/grep/budget.xlsx
  Budget!B2  display  1,234.57

$ sheetxl grep "1234.5678" examples/grep/budget.xlsx --fields value
  Budget!B2  value  1234.5678
```

`display` is what the grid shows (grep finds whatever a read printed); `value` is the
stored scalar — what `getValue()` returns and what a cell report's `Value` line and the
stats/`IRange` reads print. No number format is applied: the `Growth` cell displaying
`4.2%` stores `0.042`, and a date is its serial.

```
$ sheetxl grep "0.042" examples/grep/budget.xlsx --fields value
  Budget!E2  value  0.042
```

`value` is opt-in. A default search is for text as shown; with the scalar included, every
numeric pattern would also hit date serials and unrounded floats.

## 5. Formatted values are searchable as shown — or by their format

```
$ sheetxl grep "4.2%" examples/grep/budget.xlsx
  Budget!E2  display  4.2%

$ sheetxl grep "%" examples/grep/budget.xlsx --fields numberFormat
grep "%" · workbook · fields numberFormat · 4 cells in 1 of 2 sheets
  Budget!E2  numberFormat  0.0%
  Budget!E3  numberFormat  0.0%
  Budget!E4  numberFormat  0.0%
  Budget!E5  numberFormat  0.0%
```

The rendered text answers "where does 4.2% appear"; the `numberFormat` field answers
the different question "which cells *are* percentages" — the format code (`0.0%`,
`$#,##0.00`, `mm/dd/yyyy`) is authored text and matches by regex like any other layer.

## 6. Context — what block is this part of?

```
$ sheetxl grep "West" examples/grep/budget.xlsx -C
grep "West" · workbook · fields display,formula,comment,shape,chart,name · 2 cells in 2 of 2 sheets
  Budget!A1:F5
    A5  display  'West
  Notes!A1:A3
    A2  display  'TODO: verify West Q2 numbers
```

(`-C` takes an optional mode, so place it after the file — `-C budget.xlsx` would read
the filename as the mode and error with the choice list.)

`-C` is grep's context flag, translated to a grid: ±N lines is meaningless in 2-D, so
context is **the uniform block containing the match** — and matches are grouped under
their block, the way `rg --heading` groups under a file. When the block is a table,
its name is carried too. `-C table` restricts to enclosing tables. A bare number
(`-C 3`) is rejected, not reinterpreted.

## 7. Scope + output modes

```
$ sheetxl grep "budget" examples/grep/budget.xlsx -i --scope Notes
grep "budget" · Notes · fields display,formula,comment,shape,chart,name · 1 cell in 1 of 1 sheet
  Notes!A1  display  'Budget approved by finance 2026-07-20

$ sheetxl grep "2026-" examples/grep/budget.xlsx --output count
grep "2026-" · workbook · fields display,formula,comment,shape,chart,name · 5 cells in 2 of 2 sheets
  Budget: 4
  Notes: 1
```

`--scope` takes a sheet name (globs allowed: `"Q*"`), `Sheet!A1:D9`, or a bare range
(applied to every sheet). `--output addresses | count | sheets` mirror one-per-cell
addresses, `rg -c` (per sheet) and `rg -l`; `-v` inverts the match; `-m N` bounds the
search (default 200 cells) and reports truncation explicitly — and only when a further
match actually exists. Hidden rows, columns and sheets are excluded unless `--hidden`,
or unless a hidden sheet is named in `--scope`.
