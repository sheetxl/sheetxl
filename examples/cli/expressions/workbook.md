# Workbook

The whole-workbook report — name, locale, and the sheet roster as a routing table: each sheet's
used range and its cell/formula/error counts, with the selected (and any hidden) sheet marked
inline. A book with error values or calc failures also gets an `## Errors` / `## Calc Failures`
section with sheet-qualified addresses.

```bash
sheetxl -e "wb" expressions.xlsx
```

Expect `# Workbook`, `## Sheets (2)`, and a table row starting `| Sales (selected) |` carrying
the used range and counts.

A scalar result prints plainly:

```bash
sheetxl -e "wb.getName()" expressions.xlsx
```

Expect the string `expressions`.
