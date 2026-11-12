import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs';

import { WorkbookIO, type IShape, type IWorkbook } from '@sheetxl/sdk';

import { IOPlugin } from '..';

/**
 * A shape as current Excel inserts one survives the native format unchanged: xlsx → sxl → xlsx
 * reads back to the same shapes. The xlsx side of it — the JSON holds only intent, the writer
 * states Excel's values — is `io-xlsx`'s `shapeExcelDefaults.roundtrip.node.test.ts`, whose
 * Excel-saved fixture this reads.
 */
WorkbookIO.install(IOPlugin);

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../../../io-xlsx/src/__tests__/data/xlsx/shapeAndConnector.xlsx'));

const shapesOf = (workbook: IWorkbook): Record<string, IShape.JSON> => Object.fromEntries(
  workbook.getWorksheetAt(0)!.getMovables().getItems({ type: 'shape' })
    .map((movable) => [movable.getContent().getName?.() ?? '', movable.getContent<IShape>().toJSON()!])
);

describe('a shape as Excel inserts one (sxl)', () => {
  it('comes back from xlsx → sxl → xlsx as it went in', async () => {
    const fromExcel = (await WorkbookIO.read({ source: SOURCE, format: 'Excel' }))!;
    const native = await WorkbookIO.writeArrayBuffer(fromExcel, { format: 'sxl' }) as ArrayBuffer;
    const fromNative = (await WorkbookIO.read({ source: native, format: 'sxl' }))!;
    const xlsx = await WorkbookIO.writeArrayBuffer(fromNative, { format: 'Excel' }) as ArrayBuffer;
    const back = (await WorkbookIO.read({ source: xlsx, format: 'Excel' }))!;

    const before = shapesOf(fromExcel);
    expect(Object.keys(before).sort()).toEqual(['Rectangle 3', 'Straight Arrow Connector 2']);
    expect(shapesOf(fromNative)).toEqual(before);
    expect(shapesOf(back)).toEqual(before);
  });
});
