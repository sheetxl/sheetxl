# SheetXL — Invoice Builder example

SheetXL inside *your* app. The app owns the UI, a plain React form with no UI framework, and the
spreadsheet is the engine and a live preview.

- **App ↔ workbook:** the `useCellValue`, `useCell` and `useTable` hooks bind the form to the
  input cells, the "Total" badge to the total cell and the line items to a table, in both
  directions. A value typed into the grid shows up in the form.
- **Tables:** the line items are a table with a totals row. **Add line item** is `addRow()`, and
  Amount is a calculated column, so a new row gets its formula.
- **Calculation:** amounts, subtotal, discount, tax and total are real formulas.
- **Protection:** the sheet is locked with row inserts and deletes allowed. Input cells are marked
  `setAlwaysUnlocked(true)`, so they stay editable from the grid and from code; formula cells
  refuse edits.
- **Your own notifier:** SheetXL shows no messages of its own. [`src/Toasts.tsx`](src/Toasts.tsx)
  is a `ReactNotifierProvider` that shows them as toasts, so typing into a formula cell says why
  nothing happened.
- **Pictures:** the logo is a picture placed with `addPicture`, from a `fetch` source so the image
  is embedded in the exported file rather than linked. The logo is an original drawing for this
  example; the issuer, Cobalt Owl Design Studio, is fictional.
- **IO:** **Export** writes a real Excel file with `WorkbookIO.write`.

The template lives in [`src/invoice.ts`](src/invoice.ts) and the app in [`src/App.tsx`](src/App.tsx).

## Run

```bash
pnpm install
pnpm --filter example-invoice-builder dev
```
