# Counts

`getCounts()` is the discovery call — "how much of each feature is in here", one pass, before you
decide what to look at. It answers a different question than its neighbors: **counts** is how
much, [stats](regions-stats-style.md) is what the values are like, and **regions** is where.

**No argument counts everything** — the cheapest first look at an unknown sheet:

```bash
sheetxl -e "wb.getWorksheet().getUsedRange().getCounts()" expressions.xlsx
```

Expect a `# Counts` report over `A1:F11`:

```text
- contentful: 30
- string: 15
- number: 14
- date: 1
- error: 1
- formula: 6
- numberFormat: 3
- font: 4
```

Reading that: 30 of the 66 cells hold something (blanks are not a feature — they are
`rows × columns − contentful`, so 36 here), 6 carry formulas, and exactly 1 is an error cell —
`F2`, the `=1/0`. The styling is just as literal: the 4 bold headers (`A1:D1`) and the 3 formatted
input cells (`B8:B10`) — `B11` is forced text, which is `quotePrefix`, not a number format. This
workbook sets no fill, no borders and no alignment, so those features are absent rather than zero-
padded.

**Features are counted independently, not partitioned.** The numbers deliberately overlap and do
not sum to `contentful`: a formula cell that produces a number is counted by both, and a date is
counted as `date` *and* `number` (a date IS a number under a date-category format):

```bash
sheetxl -e "wb.getRange('B10').getCounts(['date','number','contentful'])" expressions.xlsx
```

Expect all three at `1` — one cell, three true statements about it. For a *refined* count (cells
matching a combination), you want `getRegions`, not this.

**Ask for one feature, or a few** — pass a name or an array:

```bash
sheetxl -e "wb.getWorksheet().getUsedRange().getCounts('formula')" expressions.xlsx
```

Expect a report with the single line `formula: 6`. The result object still carries the full key
set with the unrequested features as explicit `0` — the **renderer elides zeros**, because a
report of twenty zeros buries the numbers that matter. Use `--json` to see the whole record:

```bash
sheetxl -e "wb.getWorksheet().getUsedRange().getCounts()" expressions.xlsx --json
```

Expect all 22 keys, zeros included (`boolean: 0`, `merge: 0`, `table: 0`, …).

**Counts are cells, never regions or blocks.** Scoping the call to the data block drops everything
the summary row and the input showcase contributed:

```bash
sheetxl -e "wb.getRange('A2:C4').getCounts()" expressions.xlsx
```

Expect only `contentful: 9`, `string: 3`, `number: 6` — three region names and six numbers, no
formulas, because `D2:D4` is outside the range.

**It is a plain record, so drill straight through it** when you want the number rather than the
report:

```bash
sheetxl -e "wb.getWorksheet().getUsedRange().getCounts().formula" expressions.xlsx
```

Expect `6`, printed plainly — a scalar is not a renderable object.

**Any range surface has it**, including another sheet's:

```bash
sheetxl -e "wb.getWorksheet('Notes').getUsedRange().getCounts()" expressions.xlsx
```

Expect `contentful: 2`, `string: 2`.

**The style features count AUTHORED styling, not resolved styling.** Every cell resolves to a
font, a number format and an alignment — it inherits them from `Normal` — but only a cell that
overrides one counts for it. That is why the report above names `font` and `numberFormat` and says
nothing about `fill`, `border` or `alignment`. Build the same headers in memory and you get the
identical answer, because loading a workbook stores authored deltas exactly as setting them does:

```bash
sheetxl -e "const s = wb.getSelectedWorksheet(); s.getRange('A1:D1').setValues([['Region','Units','Price','Total']]); s.getRange('A1:D1').getStyle().getFont().setWeight(700); s.getUsedRange().getCounts()"
```

Expect `font: 4` and no other style feature.
