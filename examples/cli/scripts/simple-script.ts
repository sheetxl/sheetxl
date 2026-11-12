import { type IWorkbook } from '@sheetxl/sdk';

import { type RunContext } from '@sheetxl/runner';

/**
 * Example script for testing the `sheetxl` command
 */
export default async function main(ctx: RunContext): Promise<void> {
  const { wb, log, warn } = ctx;

  if (!wb) {
    warn(`No workbook provided to script. Use --help for usage information.`);
    return;
  }
  const workbook: IWorkbook = wb;

  const sheet = workbook.getSelectedWorksheet(); // or workbook.getRange('Sheet1!A1');
  log(`✓ Using sheet: ${sheet.getName()}`);

  // Set some values
  sheet.getRange('A1').setValue('Hello from script!');
  sheet.getRange('A2').setValue(42);
  sheet.getRange('A3').setValue('=A2*2');

  log('✓ Set some values...');

  // calculation is async so we need to await.
  // In short running scripts the first time will be slower as the calculation
  // engine initializes async lazily.
  await workbook.getCalculation().ready();

  log(`  A1: ${sheet.getRange('A1').getValue()}`);
  log(`  A2: ${sheet.getRange('A2').getValue()}`);
  log(`  A3: ${sheet.getRange('A3').getValue()}`);

  log('✓ Update some values...');
  sheet.getRange('A3').setValue('=A2*3');
  // calculation is async so we need to await
  await workbook.getCalculation().ready();
  log(`  A3(2): ${sheet.getRange('A3').getValue()}`);

  log(`✓ Complete`);
}
