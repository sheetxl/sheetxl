# Cell range and cell

No-arg `getRange()` is the **selected** range — selection is SDK state, saved with the
workbook, not a UI mode (consistent with no-arg `getWorksheet()` = the selected sheet):

```bash
sheetxl -e "wb.getRange()" expressions.xlsx
```

Expect `Range: Sales!A1:D6, 6 rows × 4 columns` — the selection the generator left behind.

A cell range report — counts, the data grid, formula blocks, spills, the sheet objects that
intersect it, and its place in the calculation graph, all scoped to exactly the range you name:

```bash
sheetxl -e "wb.getRange('A1:D4')" expressions.xlsx
```

Expect `# Cell Range`, `Range: A1:D4, 4 rows × 4 columns`, and a data table that excludes the
summary row and the F-column blocks.

**This is the altitude values live at.** A sheet report has no bound but the sheet's size, so it
lists *where* the blocks are; you name a rectangle, and this reads it.

The grid is a **dataframe, not a pipe table** — an index column of real row numbers, `A B C D`
column letters, minimal padding, no rules:

```text
## Data
Sales!A1:D4, 4 rows × 4 columns

   A             B       C       D
1  'Region  'Units  'Price  'Total
2  'North      120   19.99  2398.8
3  'South       80    24.5    1960
4  'East       200    9.75    1950
```

A1 addressing *is* the coordinate system, and an index plus column letters preserves it natively
— which is exactly what a CSV or a `1..n` index would throw away. The pipes and the `|---|` rule
were per-row overhead carrying no information, and on a narrow screen they are what forces the
wrap that breaks a column. Alignment is per cell, one width per column, so scanning a numeric
column for the entry that is text works at a glance. An `ICellRange` can label this way because
it knows its sheet; see `values-and-json.md` for what happens when it doesn't.

**Formulas are blocks, addressed as ranges:**

```text
## Formulas
  D2:D4  3×1  =B2*C2
```

One line per authored formula, not per cell — `getRegions(Formula)` groups by canonical R1C1, so
a filled column is `D2:D400` on one line instead of 399 that differ only in a row number (and a
block filled down *and* across is one line too — regions are rectangles). The results are
already in the grid above, so nothing is lost.

It is also what makes an exception findable: a block that *should* be one region and comes back
as two has a hole in it, and the hardcoded value someone pasted into a formula column is visible
in the addresses without reading a single formula.

**Sections with nothing in them are not printed.** No `None` headings for named ranges, hidden
headers, tables, spills or an empty half of the graph.

A cell's *state* — value, formula, format, memberships:

```bash
sheetxl -e "wb.getRange('D2').getCell()" expressions.xlsx
```

Expect `Type: number`, the computed `Display:`, and ``Formula: `=B2*C2` ``.

The error cell:

```bash
sheetxl -e "wb.getRange('F2').getCell()" expressions.xlsx
```

Expect `Type: error`, `Display: #DIV/0!`, and an `Errors:` line.

A formatted input — the percent survives as a number plus a format:

```bash
sheetxl -e "wb.getRange('B8').getCell()" expressions.xlsx
```

Expect `Display: 42%` and ``Number Format: `0%` ``.

The forced-text cell — `'0042` stayed text, zeros intact:

```bash
sheetxl -e "wb.getRange('B11').getCell()" expressions.xlsx
```

Expect `Type: string` and `Display: '0042` (the leading `'` is the type marker on read).
