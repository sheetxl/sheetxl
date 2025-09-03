import { describe, expect, it } from 'vitest';

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { IWorkbook } from '@sheetxl/sdk';

// import { WorkbookIO } from '@sheetxl/io';
import { WorkbookIO, WorkbookHandle } from '..';

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

describe("Excel Import/Export", () => {

  const tmpDir = os.tmpdir();

  it("Import", async () => {

    const buffer = fs.readFileSync(path.resolve(__dirname, './xlsx/simple.xlsx'), { flag:'r' });

    const wbh:WorkbookHandle = await WorkbookIO.read({
      source: buffer,
      formatType: 'xlsx',
      name: 'simple.xlsx'
    });

    const wb = wbh.workbook;
    const ws = wb.getSheets().getByName('Data');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
    expect(true).toEqual(true);
  });

  it("Export", async () => {
    const workbook:IWorkbook = createSimpleWorkbook(); // Create a simple workbook
    const buffer:ArrayBuffer = await WorkbookIO.toArrayBuffer(workbook, 'xlsx');

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