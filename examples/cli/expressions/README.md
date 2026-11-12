# Expression examples

Copy-pasteable `sheetxl -e` one-liners, each read against the `expressions.xlsx` in this
folder. Run them from this directory. They double as a behavior reference for agents: every
file states what the line should return, and the workbook layout below is the closed world the
answers come from.

```bash
cd examples/cli/expressions
sheetxl -e "wb" expressions.xlsx
```

Inside the repo (no global install), substitute the command:

```bash
node <repo>/packages/cli/build/cli.js -e "wb" expressions.xlsx
```

## How `-e` behaves

- The workbook is the trailing positional argument, and the snippet gets it as an implicit `wb`
  (a blank workbook when none is named), plus top-level await.
- The final expression's value is rendered **by default**: renderable SDK objects (workbook,
  sheet, cell range, cell, table, regions, stats, counts, style, and pure value grids —
  `IRange` or `Scalar[][]`) become markdown reports via the `@sheetxl/query` renderer registry;
  strings pass through; scalars print plainly; anything else falls back to JSON. `--json` switches to the machine encoding. An `undefined` result prints
  nothing.
- Nothing is written unless you say so: `--save` writes back to the workbook that was opened,
  and `--out <file>` writes elsewhere.
- Because there is code (`-e`), the command runs and exits. Drop the `-e` and the same line
  (`sheetxl expressions.xlsx`) opens an interactive session on the workbook instead.

## The workbook (`expressions.xlsx`)

Sheet **Sales** (selected):

| Where | What |
|---|---|
| A1:D1 | Bold headers: Region, Units, Price, Total |
| A2:C4 | North/South/East rows (Units, Price) |
| D2:D4 | `=B2*C2` … row totals |
| A6, B6, D6 | Sum label, `=SUM(B2:B4)` (400), `=SUM(D2:D4)` |
| F2 | `=1/0` → `#DIV/0!` |
| A8:B8 | Growth, `42%` (number 0.42, percent format) |
| A9:B9 | Budget, `$1,000` (number, currency format) |
| A10:B10 | Start, `1/15/2026` (date) |
| A11:B11 | Code, `'0042` (forced text — keeps the leading zeros) |
| F8:F9 | Notes / Reviewed (a second contentful region) |

Sheet **Notes**: A1 `Follow-ups`, A2 `Confirm East pricing`.

## The examples

| File | Covers |
|---|---|
| [workbook.md](workbook.md) | The workbook report — start here |
| [sheet.md](sheet.md) | Sheet reports, both sheets |
| [range-and-cell.md](range-and-cell.md) | Cell range reports, cell state (formula, error, formats) |
| [dependencies.md](dependencies.md) | Precedents and dependents, on both a cell and a range |
| [regions-stats-style.md](regions-stats-style.md) | Structure, value statistics, styling |
| [counts.md](counts.md) | `getCounts` — per-feature cell counts, the discovery call |
| [values-and-json.md](values-and-json.md) | Raw values, `--json`, the text-encoding rules |
| [log-and-errors.md](log-and-errors.md) | the `log` channel, runtime errors, error cells |
| [write-and-save.md](write-and-save.md) | Writes, `--save`, the calculator idiom |

## Regenerating the workbook

`expressions.xlsx` is built by [`_expressions.gen.ts`](_expressions.gen.ts) — the `.gen.ts`
suffix marks it as the source of a checked-in artifact rather than an example to run.

It is kept around because `.xlsx` is a zip of XML: a commit touching the fixture shows up as
`Bin 7234 -> 7301 bytes`, so without a generator a reviewer cannot see what changed. The examples
here describe what the workbook contains; the generator is the reviewable record of how it got
that way.

The layout table above and that script are kept in sync. Regenerate from this folder:

```bash
sheetxl -f _expressions.gen.ts --out expressions.xlsx
```
