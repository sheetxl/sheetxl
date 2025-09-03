import { describe, expect, it } from 'vitest';

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { IWorkbook, Workbook } from '@sheetxl/sdk';

import { toBufferCSV, fromBufferCSV, WriteCSVOptions } from '../handlers';

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

// TODO - add csv callback
describe("CSV Import/Export", () => {

  const tmpDir = os.tmpdir();

  it("Export Simple", async () => {
    const workbook = createSimpleWorkbook(); // Create a simple workbook

    const options:WriteCSVOptions = {};
    const buffer:ArrayBuffer = await toBufferCSV(workbook, options);

    const tmpCSV = path.resolve(tmpDir, 'csv');
    try {
      fs.mkdirSync(tmpCSV, { recursive: true });
    } catch (err) {
      // console.log(err);
    }
    fs.writeFileSync(path.resolve(tmpCSV, './simple.csv'), Buffer.from(buffer));

    expect(true).toEqual(true);
  });

  it("Import With quotes and spaces", async () => {
    const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './csv/simple-quotes-in.csv'), {flag:'r'});
    const workbook:IWorkbook = await fromBufferCSV(buffer);

    const ws = workbook.getSheets().getByName('Sheet1');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('This is a string with spaces.');
    expect(true).toEqual(true);
  });

  it("Import Simple", async () => {
    const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './csv/simple.csv'), {flag:'r'});
    const workbook:IWorkbook = await fromBufferCSV(buffer);

    const ws = workbook.getSheets().getByName('Sheet1');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
    expect(true).toEqual(true);
  });

  it("Export not at 2,2", async () => {
    const workbook = createSimpleWorkbook({ rowIndex: 2, colIndex: 2 }); // Create a simple workbook

    const options:WriteCSVOptions = {};
    const buffer:ArrayBuffer = await toBufferCSV(workbook, options);
    const tmpCSV = path.resolve(tmpDir, 'csv');
    try {
      fs.mkdirSync(tmpCSV, { recursive: true });
    } catch (err) {
      // console.log(err);
    }
    fs.writeFileSync(path.resolve(tmpCSV, './simple-2.csv'), Buffer.from(buffer));

    // fs.writeFileSync('.tmp/simple-2.csv', Buffer.from(buffer));

    expect(true).toEqual(true);
  });

  it("Export blank", async () => {
    const workbook = new Workbook();

    const options:WriteCSVOptions = {};
    let error = true;
    try {
      const buffer:ArrayBuffer = await toBufferCSV(workbook, options);
      fs.writeFileSync('.tmp/blank.csv', Buffer.from(buffer));
    } catch (e) {
      error = true;
    }
    expect(error).toEqual(true);
  });

});