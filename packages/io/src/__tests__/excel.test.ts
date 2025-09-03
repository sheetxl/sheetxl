import { describe, expect, it } from 'vitest';

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { IWorkbook, ISheetView } from '@sheetxl/sdk';

import { toBufferXLSX, fromBufferXLSX } from '../handlers';

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

/**
 *
 * Apache POI has a lot of test data:
 *
 * https://svn.apache.org/repos/asf/poi/trunk/test-data/spreadsheet/
 *
 * Sheet JS has a lot of test data too:
 * Look for SheetJs unit tests too.
 */
describe("Excel Import/Export", () => {

  const tmpDir = os.tmpdir();

  it("Import Styles", async () => {
    // const relativePath = '/Users/model/Downloads/broken.xlsx';
    const relativePath = './xlsx/styled.xlsx';
    const buffer = fs.readFileSync(path.resolve(__dirname, relativePath), {flag:'r'});
    const workbook:IWorkbook = await fromBufferXLSX(buffer);

    const view:ISheetView|undefined = workbook?.getSheets().getByName('Data')?.getView();
    const isShowRowGridLines:boolean = view?.isShowColumnGridlines() ?? false;

    // const _ws = workbook.getSheets().getByName('Data');
    // expect(ws.getCell('A7').getValue()).toEqual('this has spaces');
    expect(true).toEqual(true);
  });

  it("Import", async () => {
    const buffer = fs.readFileSync(path.resolve(__dirname, './xlsx/simple.xlsx'), {flag:'r'});
    const workbook:IWorkbook = await fromBufferXLSX(buffer);

    const ws = workbook.getSheets().getByName('Data');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
    expect(true).toEqual(true);
  });

  it("Export", async () => {
    const workbook:IWorkbook = createSimpleWorkbook(); // Create a simple workbook
    const buffer:ArrayBuffer = await toBufferXLSX(workbook);
    const tmpXLSX = path.resolve(tmpDir, 'xlsx');
    try {
      fs.mkdirSync(tmpXLSX, { recursive: true });
    } catch (err) {
      // console.log(err);
    }

    fs.writeFileSync(path.resolve(tmpXLSX, './simple.xlsx'), Buffer.from(buffer));

    expect(true).toEqual(true);
  });

});