import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs'; // for write outputs

import { IWorkbook, Workbook } from '@sheetxl/sdk';

import { type WriteCSVOptions } from '../handlers';

import { WorkbookIO } from '..';

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

// TODO - add csv callback
describe("Import/Export", () => {
  it("Import CSV With quotes and spaces", async () => {
    const workbook: IWorkbook = await WorkbookIO.read({
      source: fs.readFileSync(path.resolve(__dirname, './csv/simple-quotes-in.csv'), {flag:'r'}) as any,
      // format: 'csv'
      name: 'simple-quotes-in.csv'
    });
    // const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './csv/simple-quotes-in.csv'), {flag:'r'});
    // const workbook:IWorkbook = await fromBufferCSV(buffer);

    const ws = workbook.getSheets().getByName('Sheet1');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('This is a string with spaces.');
    expect(true).toEqual(true);
  });

  it("Export using different tags", async () => {
    const workbook = createSimpleWorkbook(); // Create a simple workbook
    // Get the temporary directory of the system
    const tmpDir = os.tmpdir();
    let dirName: string
    try {
      dirName = path.resolve(tmpDir, 'exports');
      fs.mkdirSync(dirName, { recursive: true });
    } catch (err) {
      // console.log(err);
    }

    const success = await WorkbookIO.writeFile(
      path.resolve(tmpDir, './exports/simple'),
      workbook, {
        format: 'sxl',
        compress: false,
      } as any
    );

    expect(success).toEqual(true);
  });

  // it("Import Simple", async () => {
  //   const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './csv/simple.csv'), {flag:'r'});
  //   const workbook:IWorkbook = await fromBufferCSV(buffer);

  //   const ws = workbook.getSheets().getByName('Sheet1');
  //   expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
  //   expect(true).toEqual(true);
  // });

  // it("Export Simple", async () => {
  //   const workbook = createSimpleWorkbook(); // Create a simple workbook

  //   const options:WriteCSVOptions = {};
  //   const buffer:ArrayBuffer = await toBufferCSV(workbook, options);
  //   // fs.writeFileSync('/tmp/simple.csv', Buffer.from(buffer));

  //   expect(true).toEqual(true);
  // });

  // it("Export not at 2,2", async () => {
  //   const workbook = createSimpleWorkbook({ rowIndex: 2, colIndex: 2 }); // Create a simple workbook

  //   const options:CsvExportOptions = {};
  //   const buffer:ArrayBuffer = await toBufferCSV(workbook, options);

  //   // Get the temporary directory of the system
  //   const tmpDir = os.tmpdir();
  //   try {
  //     const dirName = path.resolve(tmpDir, 'csv');
  //     fs.mkdirSync(dirName, { recursive: true });
  //   } catch (err) {
  //     // console.log(err);
  //   }
  //   // fs.mkdtemp('foo-', (err, folder) => {
  //   //   if (err)
  //   //     console.log(err);
  //   //   else {
  //     fs.writeFileSync(path.resolve(tmpDir, './csv/simple-2.csv'), Buffer.from(buffer));
  //   //   }
  //   // });

  //   expect(true).toEqual(true);
  // });

  // it("Export blank", async () => {
  //   const workbook = new Workbook();

  //   workbook.getRange('A1').setValues([['one value']]);
  //   const options:WriteCSVOptions = {};
  //   await WorkbookIO.writeFile(
  //     path.resolve(__dirname, './csv/simple-quotes-in.csv'),
  //     workbook
  //   );
  //   // const buffer:ArrayBuffer = await toBufferCSV(workbook, options);
  //   // Get the temporary directory of the system
  //   const tmpDir = os.tmpdir();
  //   try {
  //     const dirName = path.resolve(tmpDir, 'csv');
  //     fs.mkdirSync(dirName, { recursive: true });
  //   } catch (err) {
  //     // console.log(err);
  //   }

  //   fs.writeFileSync(path.resolve(tmpDir, './csv/blank.csv'), Buffer.from(buffer));

  //   expect(true).toEqual(true);
  // });

});