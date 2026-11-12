/**
 * Generates `expressions.xlsx` — the workbook every example in this folder reads.
 *
 * Usage (from this folder):
 *   npx sheetxl -f _expressions.gen.ts --out expressions.xlsx
 *
 * **Not an example.** The `.gen.ts` suffix says what this is: the source of a checked-in
 * artifact, named after the artifact it produces. It sits beside the workbook rather than with
 * the examples because it is the workbook's source, and it exists at all because `.xlsx` is a
 * zip of XML — a commit that touches the fixture shows up as `Bin 7234 -> 7301 bytes`, so
 * without this a reviewer cannot see what changed. The examples describe what the workbook
 * *contains*; this is the reviewable record of how it got that way.
 *
 * The content is arranged so every example has something to read:
 *   - A1:D4 is a bold-headed data block with a formula column (D2:D4 = `=B2*C2`).
 *   - Row 6 totals it; F2 holds `=1/0` → a live #DIV/0!.
 *   - A8:B11 is a form layout showing input parsing: percent, currency, date, forced text.
 *   - F8:F9 is a second contentful region, separated by blank rows and columns.
 *   - B2 → D2 → D6 is a two-level calculation chain for the dependency examples.
 *   - The selection is left at A1:D6, which no-arg `wb.getRange()` reads.
 *
 * Keep this script and the layout table in ../expressions/README.md in sync — the README is what
 * a reader (human or agent) uses to predict what an expression should return.
 */
import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { type RunFunction, type RunContext } from '@sheetxl/runner';

const main: RunFunction = async (_ctx: RunContext): Promise<IWorkbook> => {
  const workbook = new Workbook();
  await workbook.getCalculation().start();

  const sales = workbook.getWorksheetAt(0);
  sales.setName('Sales');

  // Headers (bold) + data block.
  sales.getRange('A1:D1').setValues([['Region', 'Units', 'Price', 'Total']]);
  sales.getRange('A1:D1').getStyle().getFont().setWeight(700);
  sales.getRange('A2:C4').setValues([
    ['North', 120, 19.99],
    ['South', 80, 24.5],
    ['East', 200, 9.75]
  ]);
  sales.getRange('D2').setValue('=B2*C2');
  sales.getRange('D3').setValue('=B3*C3');
  sales.getRange('D4').setValue('=B4*C4');

  // Summary row.
  sales.getRange('A6').setValue('Sum');
  sales.getRange('B6').setValue('=SUM(B2:B4)');
  sales.getRange('D6').setValue('=SUM(D2:D4)');

  // A calculation error — the cell reads #DIV/0!.
  sales.getRange('F2').setValue('=1/0');

  // Input-parsing showcase: percent, currency, date, forced text (all set as strings — the
  // same rule as typing into Excel).
  sales.getRange('A8:B8').setValues([['Growth', '42%']]);
  sales.getRange('A9:B9').setValues([['Budget', '$1,000']]);
  sales.getRange('A10:B10').setValues([['Start', '1/15/2026']]);
  sales.getRange('A11:B11').setValues([["Code", "'0042"]]);

  // A second contentful region, separated by blank rows/columns.
  sales.getRange('F8:F9').setValues([['Notes'], ['Reviewed']]);

  // A second sheet.
  const notes = workbook.addWorksheet('Notes');
  notes.getRange('A1').setValue('Follow-ups');
  notes.getRange('A2').setValue('Confirm East pricing');

  // Leave a meaningful selection — selection is SDK state (not a UI mode), and no-arg
  // `wb.getRange()` reads it.
  await sales.getRange('A1:D6').select();
  await workbook.getCalculation().ready();
  return workbook;
};

export default main;
