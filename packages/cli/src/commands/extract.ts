import fs from 'node:fs';
import path from 'node:path';

import chalk from 'chalk'; // Import chalk

import { Modules } from './Types';
import { type WorkbookHandle } from '@sheetxl/io';
import { Notifier, IWorkbook } from '@sheetxl/sdk';

/**
 * Example node file that extracts workbook information from an xlsx file and converts to JSON.
 */

// TODO - write to a file with an output format
// TODO - have an range option that will only return the range requested
// TODO - file name utils
export default async (args: any[], modules?: Modules): Promise<void> => {
  const fileName: string = args[0];
  const range: string = args[1];
  if (range) {
    Notifier.log('extract range:', { details: range });
  }
  const options: Record<string, string> = args[2];
  if (options && Object.keys(options).length > 0) {
    // TODO - pass to importer
    Notifier.log('extract options:', { details: options });
  }
  const quiet: boolean = modules.program.opts()?.quiet ?? false;

  let asName: string = fileName;
  // TODO - use io utils for this.
  if (!asName.endsWith('.xlsx')) {
    asName += '.xlsx';
  }
  let asPath = path.resolve(process.cwd(), asName);
  let buffer: Buffer= null;
  if (!fs.existsSync(asPath)) {
    console.error(`File not found: ${asPath}`);
    process.exit(1);
  }

  try {
    buffer = fs.readFileSync(asPath, { flag: 'r' });
  } catch (error: any) {
    Notifier.error('Unable to read file:', { details: asPath });
    process.exit(1);
  }

  let wbh: WorkbookHandle = null;
  try {
    const moduleIO = modules.io;
    wbh = await moduleIO.WorkbookIO.read({ name: asName, source: buffer.buffer });
    if (!quiet) {
      wbh
      const asJSON: IWorkbook.JSON = await wbh.workbook.toJSON();
      Notifier.log(chalk.yellow(`${JSON.stringify(asJSON, null, 2)}`));
    }
  } catch (error: any) {
    Notifier.error(`Unable to parse '${asName}' as a workbook`, { details: error });
    process.exit(1);
  }

  // console.log('range:', workbook.getRange('A1:B2').toString());
  // console.log('range Values:', workbook.getRange('A1:B2').getValues({ asJSDate: true }));
};