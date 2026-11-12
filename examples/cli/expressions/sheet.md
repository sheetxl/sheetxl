# Sheet

The selected sheet's report — counts, one section per feature partition, then named ranges,
hidden headers and tables. Unqualified `getWorksheet()` means the selected sheet
(`getSelectedWorksheet()` is the explicit spelling of the same thing):

```bash
sheetxl -e "wb.getWorksheet()" expressions.xlsx
```

Expect `# Sheet`, `Name: Sales`, a `## Counts` list, then `## Contentful (6)`,
`## Formula (4)`, `## NumberFormat (3)` and `## Font (1)` — each listing its extents, with the
authored payload alongside (`=B2*C2`, `0%`, `bold`).

`Contentful` reports **maximal rectangles**: `A1:D4` is one region, not the four column strips
the index stores it as. Occupancy has no payload for two rectangles to disagree about, so the
stored blocks are storage rather than structure.

**The feature is the heading.** A region *is* a partition of a feature, so there is no umbrella
section above them: a feature carrying nothing is simply absent, and `Counts` already said so.
A heading like `Regions` would name a category that does not exist, and "Regions: None" would
assert something that cannot be true of a sheet holding content.

**No cell values appear.** Altitude governs content: a sheet report says *where* things are and
*how much* of each there is, so it stays bounded by the sheet's structure rather than its size.
The addresses it lists are what a values read consumes next — see `values-and-json.md`.

A payload is authored content, never a computed one. `=B2*C2` sits beside `D2:D4` — one region,
because `getRegions` groups formulas by canonical R1C1, so the block really is one authored
formula — while `2398.8` appears only in a range report.

`--md.features` narrows what the report prints — a report filter, not a query one, so the
expression stays the same:

```bash
sheetxl -e "wb.getWorksheet()" expressions.xlsx --md.features=numberFormat,font
```

Expect `## Counts` down to two lines and only the `NumberFormat` and `Font` sections. Ask for a
feature the sheet does not carry (`--md.features=fill`) and those sections are simply gone, with
`Counts` reporting `None`. An unknown name errors with the full vocabulary, before the workbook
is even read.

A sheet by name:

```bash
sheetxl -e "wb.getWorksheet('Notes')" expressions.xlsx
```

Expect `Name: Notes` and its region map.
