import { type IWorkbook } from '@sheetxl/sdk';

import { type RunContext } from '@sheetxl/runner';

/**
 * Example script for testing the `sheetxl` command
 */
export default async function main(ctx: RunContext): Promise<void |IWorkbook> {
  const { wb, log } = ctx;

  log(`TODO - Look for errors in workbook...`);

  // `wb` is null when the CLI was given no workbook; returning nothing says "produced none".
  return wb ?? undefined;
}
