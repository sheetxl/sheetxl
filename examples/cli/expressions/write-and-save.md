# Writes and saving

Nothing is written unless you ask. These examples save to a **copy** so `expressions.xlsx`
stays pristine for the other examples (regenerate it with `_expressions.gen.ts` if you do
overwrite it).

Set a value and save elsewhere — the rendered result is the range `setValue` returns, so you
see what you changed:

```bash
sheetxl -e "wb.getRange('F1').setValue('reviewed')" expressions.xlsx --out expressions-out.xlsx
```

Set a formula, save to the copy, and read it back from the copy:

```bash
sheetxl -e "wb.getRange('F6').setValue('=AVERAGE(B2:B4)')" expressions.xlsx --out expressions-out.xlsx
sheetxl -e "wb.getRange('F6').getCell()" expressions-out.xlsx
```

Expect the second line to show ``Formula: `=AVERAGE(B2:B4)` `` with `Display:` ≈ 133.33.

The value-encoding rule on write — a string does what typing it into Excel does:

```bash
sheetxl -e "wb.getRange('F7').setValue('42%').getCell()" expressions.xlsx --out expressions-out.xlsx
```

Expect `Type: number`, `Display: 42%`, ``Number Format: `0%` `` — value 0.42 plus a format,
not a string.

**The calculator idiom** — no `--in` gives a blank workbook; no `--save` means nothing
persists:

```bash
sheetxl -e "1 + 2 * 3"
```

Expect `7`.
