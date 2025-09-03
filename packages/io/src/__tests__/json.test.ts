import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs
import * as os from 'os';

import { IWorkbook } from '@sheetxl/sdk';

import { toBufferJSON, fromBufferJSON } from '../handlers';
import createSimpleWorkbook from './helpers/createSimpleWorkbook';

describe("JSON Import/Export", () => {

  it("Import", async () => {
    const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './json/simple.json'), {flag:'r'});
    const workbook:IWorkbook = await fromBufferJSON(buffer);

    const ws = workbook.getSheets().getByName('Data');
    expect(ws?.getRange('A1').getCell().getValue()).toEqual('this has spaces');
  });

  it("Export", async () => {
    const workbook = createSimpleWorkbook(); // Create a simple workbook

    const options = {};
    const buffer:ArrayBuffer = await toBufferJSON(workbook, options);

    try {
      const dirName = path.resolve(os.tmpdir(), 'json');
      fs.mkdirSync(dirName, { recursive: true });
      fs.writeFileSync(path.resolve(dirName, 'simple.json'), Buffer.from(buffer));
    } catch (err) {
      // console.log(err);
    }

    expect(true).toEqual(true);
  });
});