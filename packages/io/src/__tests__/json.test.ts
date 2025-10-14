import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs
import * as os from 'os';

import { IWorkbook } from '@sheetxl/sdk';

import { WorkbookIO } from '..';

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

describe("JSON Import/Export", () => {

  it("Import", async () => {
    const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './json/simple.json'), {flag:'r'}) as unknown as ArrayBuffer;

    const workbook:IWorkbook = await WorkbookIO.read({
      source: buffer,
      // format: 'json',
      name: 'simple.json'
    });

    const ws = workbook.getSheets().getByName('Data');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
  });

  it("Export", async () => {
    const workbook = createSimpleWorkbook(); // Create a simple workbook

    const options = {};
    // const buffer:ArrayBuffer = await WorkbookIO.write({ workbook, format: 'json' });
    // const buffer:ArrayBuffer = await toBufferJSON(workbook, options);
    let success = false;
    try {
      const dirName = path.resolve(os.tmpdir(), 'json');
      fs.mkdirSync(dirName, { recursive: true });
      success = await WorkbookIO.writeFile(
        path.resolve(dirName, 'simple.json'),
        workbook,
        // { format: 'json' }
      );
    } catch (err) {
      console.log(err);
    }

    expect(success).toEqual(true);
  });
});