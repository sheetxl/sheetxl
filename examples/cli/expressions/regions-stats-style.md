# Regions, stats, style

**Regions** — the uniform blocks the engine detects; address structure instead of guessing
ranges. The result is a partition that knows the features it partitioned on; the renderer prints
them in the heading and caps the listing:

```bash
sheetxl -e "wb.getWorksheet().getRegions()" expressions.xlsx
```

Expect `# Regions — contentful (N)` with one address + dimensions per line (the data block, the
input block, the notes block). The sheet partitions itself — the `getRange(…)` form is for when
you want to *constrain* the query.

Partition by a specific feature:

```bash
sheetxl -e "wb.getWorksheet().getRegions('formula')" expressions.xlsx
```

Expect only the formula-bearing blocks: `D2:D4`, the two sum cells, and the error cell `F2`
(an erroring formula is still a formula).

A region answers *where*. To read one, take the hop — `region.getCell()` for the anchor (whose
read is the whole region's payload, since it is uniform) or `region.getRange()` for the block:

```bash
sheetxl -e "[...wb.getWorksheet().getRegions('formula')][0].getCell().getFormula()" expressions.xlsx
```

**Stats** — value statistics for a range (occupancy, numeric aggregates):

```bash
sheetxl -e "wb.getRange('B2:B4').getStats()" expressions.xlsx
```

Expect `Sum: 400`, `Min: 80`, `Max: 200`, `Average: 133.33…`.

**Style** — the named style a cell derives from, plus its direct overrides:

```bash
sheetxl -e "wb.getRange('A1').getStyle()" expressions.xlsx
```

Expect `Named: Normal` and a `font` override carrying `"weight":700` (the bold header).
An unstyled cell reports no direct styling:

```bash
sheetxl -e "wb.getRange('A2').getStyle()" expressions.xlsx
```
