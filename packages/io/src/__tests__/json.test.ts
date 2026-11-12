import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs
import * as os from 'os';
import { fileURLToPath } from 'url';

import { WorkbookIO, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

const TEST_PATH = path.dirname(fileURLToPath(import.meta.url));

describe("JSON Import/Export", () => {

  it("Import", async () => {
    const buffer: ArrayBuffer = fs.readFileSync(path.resolve(TEST_PATH, './json/simple.json'), {flag:'r'}) as unknown as ArrayBuffer;

    const workbook: IWorkbook = (await WorkbookIO.read({
      source: buffer,
      format: 'json' // a bare buffer carries no extension, so the format must be explicit
    }))!;

    const ws: IWorksheet = workbook.getWorksheets().getByName('Sheet1')!;
    expect(ws?.getRange('B2').getCell().getValue()).toEqual('hello world');
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
      const details = await WorkbookIO.write(workbook, path.resolve(dirName, 'simple.json'));
      success = !!details;
    } catch (err) {
      console.log(err);
    }

    expect(success).toEqual(true);
  });
});