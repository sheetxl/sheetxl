# Values and JSON

Raw values — a `Scalar[][]` renders as a bare grid:

```bash
sheetxl -e "wb.getRange('A1:C4').getValues()" expressions.xlsx
```

`getValuesRange()` is the same grid through the stateless value layer:

```bash
sheetxl -e "wb.getRange('A1:C4').getValuesRange()" expressions.xlsx
```

Expect `# Values`, `Size: 4 rows × 3 columns`, and a grid with **no index and no column
letters**:

```text
'Region  'Units  'Price  'Total
'North      120   19.99  2398.7999999999997
'South       80    24.5                1960
```

Neither an `IRange` nor a plain array knows a sheet, so neither has an address — labelling them
`A`/`1` would assert a position that is not part of the data. It is the same dataframe the cell
range report uses, minus the labels it has no right to.

Numbers also come back unformatted (`2398.7999999999997`, not `2398.80`): there is no cell here
to carry a number format. Both are why this is a separate renderer from the cell range report
rather than a flag on it.

Alignment still holds — numbers right, everything else left. With no cell to ask for a render
alignment the type *is* the alignment, which is what keeps a stray string in a numeric column
visible without reading it.

`--json` makes the machine encoding explicit (and applies to any result):

```bash
sheetxl -e "wb.getRange('A1:C4').getValues()" expressions.xlsx --json
```

The text form follows the read-back rule — what you read, written back, reproduces the cell.
Strings carry the `'` prefix; formatted numbers show their formatted face:

```bash
sheetxl -e "wb.getRange('A8:B11').getText()" expressions.xlsx
```

Expect lines like `"'Growth",42%` and `"'Code","'0042"` — prefixed strings are CSV-quoted,
formatted numbers show their formatted face unquoted.

A single value:

```bash
sheetxl -e "wb.getRange('B6').getValue()" expressions.xlsx
```

Expect `400` — the computed sum, as a plain scalar.
