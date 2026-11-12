/**
 * Generates `inventory.xlsx` — the pattern-matching demo workbook for `sheetxl grep`
 * (see ../grep/demo-patterns.md).
 *
 * Usage:
 *   npx sheetxl -f examples/scripts/generate-inventory.ts --out examples/grep/inventory.xlsx
 *
 * The content is arranged so the pattern flags have something to disambiguate:
 *   - SKU codes (AB-1042 …)                → regex demos.
 *   - Status in mixed case                 → -i / --ignore-case.
 *   - "ship" inside "shipped"/"shipment"   → -w / --word.
 *   - C5 stores the STRING '0042 beside the NUMBER 42 → the `'` encoding in results.
 */
import { Workbook } from '@sheetxl/sdk';

import { type RunContext } from '@sheetxl/runner';

const main = async (ctx: RunContext): Promise<any> => {
  const workbook = ctx.wb ?? new Workbook();
  if (!ctx.wb) await workbook.getCalculation().start();

  const sheet = workbook.getWorksheetAt(0);
  sheet.setName('Inventory');

  sheet.getRange('A1:D1').setValues([['SKU', 'Item', 'Qty', 'Status']]);
  sheet.getRange('A1:D1').getStyle().getFont().setWeight(700);

  sheet.getRange('A2:D6').setValues([
    ['AB-1042', 'Widget, small',   42,  'Shipped'],
    ['AB-2077', 'Widget, large',   17,  'shipped'],
    ['CD-1042', 'Gadget',          0,   'ship pending'],
    ['CD-9001', 'Gizmo',           250, 'SHIPPED'],
    ['EF-3300', 'Shipment crate',  8,   'In transit']
  ]);

  // The classic trap pair: C7 the number 42, C8 the STRING '0042 (forced text).
  sheet.getRange('B7:C7').setValues([['Reorder threshold', 42]]);
  sheet.getRange('B8:C8').setValues([['Legacy code', "'0042"]]);

  await workbook.getCalculation().ready();
  ctx.log('✓ inventory demo workbook built');
  return workbook;
};

export default main;
