import fs from 'node:fs';
import path from 'node:path';

import { Modules } from './Types';

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
    console.log('extract range:', range);
  }
  const options: Record<string, string> = args[2];
  if (options && Object.keys(options).length > 0) {
    // TODO - pass to importer
    console.log('extract options:', options);
  }
  const isVerbose: boolean = modules.program.opts()?.verbose ?? false;
  // const moduleCore = await import('../../../../packages/sdk/src/index.ts');
  const sdk = modules.sdk;
  // print the license banner. Required for unlicensed versions.
  isVerbose && sdk.LicenseManager.printBanner();
  // or set the license key
  // LicenseManager.setLicenseKey('visit https://my.sheetxl.com to generate a license key.');

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
  } catch (error) {
    console.log('Unable to read file:', asPath);
    console.error(error);
    process.exit(1);
  }

  let workbook: any = null; // IWorkbook
  try {
    const moduleIO = modules.io;
    workbook = await moduleIO.WorkbookIO.read({ source: buffer.buffer });
    if (isVerbose) {
      const asJSON = await workbook.toJSON(); // IWorkbook.JSON
      // TODO - use our util so that the data not printed so awfully.
      console.log(`Workbook JSON: ${JSON.stringify(asJSON, null, 2)}`);
    }
  } catch (error: any) {
    console.log(`Unable to parse '${asName}' as a workbook`);
    console.error(error);
    process.exit(1);
  }

  // console.log('range:', workbook.getRange('A1:B2').toString());
  // console.log('range Values:', workbook.getRange('A1:B2').getValues({ asJSDate: true }));
};