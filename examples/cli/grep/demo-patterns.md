# grep demo — inventory.xlsx (patterns & matching)

Regenerate the workbook:

```sh
npx sheetxl -f examples/scripts/generate-inventory.ts --out examples/grep/inventory.xlsx
```

The workbook: an `Inventory` sheet with SKU codes, mixed-case statuses, and the classic
trap pair — the **number** `42` in C2/C7 beside the **string** `'0042` in C8.

## 1. Case — grep is case-sensitive like rg; `-i` widens

```
$ sheetxl grep "shipped" examples/grep/inventory.xlsx
grep "shipped" · workbook · fields display,formula,comment,shape,chart,name · 1 cell in 1 of 1 sheet
  Inventory!D3  display  'shipped

$ sheetxl grep "shipped" examples/grep/inventory.xlsx -i
grep "shipped" · workbook · fields display,formula,comment,shape,chart,name · 3 cells in 1 of 1 sheet
  Inventory!D2  display  'Shipped
  Inventory!D3  display  'shipped
  Inventory!D5  display  'SHIPPED
```

## 2. Word boundaries — `ship` without `shipped`/`shipment`

```
$ sheetxl grep "ship" examples/grep/inventory.xlsx -i -w
grep "ship" · workbook · fields display,formula,comment,shape,chart,name · 1 cell in 1 of 1 sheet
  Inventory!D4  display  'ship pending
```

Text edges count as boundaries (as line edges do in `rg -w`), so `-w` also works on
patterns that start or end on a non-word character — `$1,234`, `4%`, `#N/A`.

`-v` inverts: the cells where *no* requested field matched, each reported once with
its first text layer as the evidence line — "which status cells are not shipped" is
one flag, not a second tool.

## 3. Regex by default — like every grep

The pattern is a regular expression, no flag needed (rg's contract; full JS `RegExp`
semantics, so lookaround and backreferences work too):

```
$ sheetxl grep "^AB-\d+$" examples/grep/inventory.xlsx
  Inventory!A2  display  'AB-1042
  Inventory!A3  display  'AB-2077

$ sheetxl grep "CD-\d+" examples/grep/inventory.xlsx
  Inventory!A4  display  'CD-1042
  Inventory!A5  display  'CD-9001
```

Note `^` anchors work on strings — patterns match the bare text; the `'` appears only
in results.

`-F` / `--fixed-strings` searches the literal text (rg `-F`):

```
$ sheetxl grep "1042" examples/grep/inventory.xlsx -F
  Inventory!A2  display  'AB-1042
  Inventory!A4  display  'CD-1042
```

A malformed regex says so and points at the escape hatch:

```
$ sheetxl grep "1042 (" examples/grep/inventory.xlsx
Invalid regex "1042 (": Invalid regular expression: /1042 (/: Unterminated group. Use fixedStrings (-F) to search for the literal text.
```

## 4. The number/string trap — the `'` prefix is the type signal

```
$ sheetxl grep "42" examples/grep/inventory.xlsx
grep "42" · workbook · fields display,formula,comment,shape,chart,name · 5 cells in 1 of 1 sheet
  Inventory!A2  display  'AB-1042
  Inventory!C2  display  42
  Inventory!A4  display  'CD-1042
  Inventory!C7  display  42
  Inventory!C8  display  '0042
```

Five hits, three kinds: substrings of SKUs, the bare number `42`, and the *string*
`'0042`. Anchored, only the true numbers survive:

```
$ sheetxl grep "^42$" examples/grep/inventory.xlsx
  Inventory!C2  display  42
  Inventory!C7  display  42
```

`'0042` is excluded — it is text, and its text is `0042`. Search it by its own
characters:

```
$ sheetxl grep "0042" examples/grep/inventory.xlsx
  Inventory!C8  display  '0042
```

One convention carries the whole distinction: match against bare text, read results
with the `'` marking what is a string.
