/**
 * Generates `budget.xlsx` — the demo workbook for `sheetxl grep` (see ../grep/demo-budget.md).
 *
 * Usage:
 *   npx sheetxl -f examples/scripts/generate-budget.ts --out examples/grep/budget.xlsx
 *
 * The content is arranged so every grep behavior has something to find:
 *   - Total column D holds formulas — except D4, a hardcoded constant (the outlier).
 *   - B2 stores 1234.5678 displayed as 1,234.57  → display vs value fields.
 *   - Growth column shows percents (0.042 → 4.2%) → grep what the grid shows.
 *   - Updated column holds dates                  → grep "2026-" finds them.
 *   - A Notes sheet holds prose                   → scope demos.
 */
import { Workbook } from '@sheetxl/sdk';

import { type RunContext } from '@sheetxl/runner';

const main = async (ctx: RunContext): Promise<any> => {
  const workbook = ctx.wb ?? new Workbook();
  if (!ctx.wb) await workbook.getCalculation().start();

  const budget = workbook.getWorksheetAt(0);
  budget.setName('Budget');

  // Headers
  budget.getRange('A1:F1').setValues([[
    'Region', 'Q1', 'Q2', 'Total', 'Growth', 'Updated'
  ]]);
  budget.getRange('A1:F1').getStyle().getFont().setWeight(700);

  // Data — B2 carries precision the display hides.
  budget.getRange('A2:C5').setValues([
    ['North', 1234.5678, 1500],
    ['South', 2000,      2250],
    ['East',  1800,      1700],
    ['West',  900,       1100]
  ]);
  budget.getRange('B2:C5').getStyle().setNumberFormat('#,##0.00');

  // Totals: formulas everywhere except D4 — the hardcoded outlier a formula grep exposes.
  budget.getRange('D2').setValue('=B2+C2');
  budget.getRange('D3').setValue('=B3+C3');
  budget.getRange('D4').setValue(3500); // ← hardcoded where a formula belongs
  budget.getRange('D5').setValue('=B5+C5');
  budget.getRange('D2:D5').getStyle().setNumberFormat('#,##0.00');

  // Growth as percents — grep matches "4.2%", the text on screen, not 0.042.
  budget.getRange('E2:E5').setValues([[0.042], [0.125], [-0.056], [0.222]]);
  budget.getRange('E2:E5').getStyle().setNumberFormat('0.0%');

  // Dates.
  budget.getRange('F2:F5').setValues([
    ['2026-07-01'], ['2026-07-15'], ['2026-06-28'], ['2026-07-15']
  ]);
  budget.getRange('F2:F5').getStyle().setNumberFormat('yyyy-mm-dd');

  // A second sheet of prose for scope demos.
  const notes = workbook.addWorksheet('Notes');
  notes.getRange('A1:A3').setValues([
    ['Budget approved by finance 2026-07-20'],
    ['TODO: verify West Q2 numbers'],
    ['Growth targets reviewed quarterly']
  ]);

  await workbook.getCalculation().ready();
  ctx.log('✓ budget demo workbook built');
  return workbook;
};

export default main;
