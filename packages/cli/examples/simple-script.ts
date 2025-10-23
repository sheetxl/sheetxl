import { type IWorkbook } from '@sheetxl/sdk';

type ModuleSDK = typeof import('@sheetxl/sdk');
type ModuleIO = typeof import('@sheetxl/io');
type Notifier = typeof import('@sheetxl/sdk').Notifier;

type RunArgs = { raw: string[]; kv: Record<string, string|boolean>; _: string[] };

type RunContext = {
  /**
   * SDK module
   */
  sdk: ModuleSDK;
  /**
   * IO module
   */
  io: ModuleIO;
  /**
   * Notifier for logging and errors
   */
  notifier: Notifier;
  /**
   * All tail args after the script
   */
  args: RunArgs;
  /**
   * If a workbook context was provided, it will be here.
   */
  workbook: IWorkbook | null;
}

// TODO - this is not yet published
// import type { Context } from '@sheetxl/runner';

/**
 * Example script for testing the `sheetxl run` command
 */
export default async function main(ctx: RunContext): Promise<void> {
  const { sdk, notifier } = ctx;

  notifier.log(`✓ Started with SDK ${sdk.VERSION}`);

  let workbook: IWorkbook;
  if (ctx.workbook) {
    workbook = ctx.workbook;
    notifier.log(`✓ Using provided workbook: ${workbook.toString()}`);
  } else {
    workbook = new sdk.Workbook({ name: 'Test Workbook', });
    notifier.log(`✓ Created new workbook: ${workbook.toString()}`);
  }

  const sheet = workbook.getSelectedSheet(); // or workbook.getRange('Sheet1!A1');
  notifier.log(`✓ Using sheet: ${sheet.getName()}`);

  // Set some values
  sheet.getRange('A1').setValue('Hello from script!');
  sheet.getRange('A2').setValue(42);
  sheet.getRange('A3').setValue('=A2*2');

  notifier.log('✓ Set some values...');

  // calculation is async so we need to await.
  // In short running scripts the first time will be slower as the calculation
  // engine initializes async lazily.
  await workbook.getCalculation().calculate();

  notifier.log(`  A1: ${sheet.getRange('A1').getValue()}`);
  notifier.log(`  A2: ${sheet.getRange('A2').getValue()}`);
  notifier.log(`  A3: ${sheet.getRange('A3').getValue()}`);

  notifier.log('✓ Update some values...');
  sheet.getRange('A3').setValue('=A2*3');
  // calculation is async so we need to await
  await workbook.getCalculation().calculate();
  notifier.log(`  A3(2): ${sheet.getRange('A3').getValue()}`);

  notifier.log(`✓ Complete`);
}
