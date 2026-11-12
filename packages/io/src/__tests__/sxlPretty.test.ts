import { describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

const decode = (buffer: ArrayBuffer): string => new TextDecoder().decode(buffer);

/**
 * The pretty-printed `.json` write goes through a hand-rolled printer rather than
 * `JSON.stringify` (the compact path uses the real thing), so the two can drift. Everything here
 * pins the printer to `JSON.stringify`'s semantics for values it cannot represent.
 */
describe('pretty-printed JSON write', () => {
  const writePretty = async (workbook: IWorkbook, beforeWrite?: (wb: IWorkbook, json: any) => void): Promise<string> => {
    const buffer = await WorkbookIO.writeArrayBuffer(workbook, {
      format: 'JSON',
      whiteSpace: 2,
      compress: false,
      beforeWrite
    } as any);
    return decode(buffer!);
  };

  it('drops a key whose value is undefined rather than writing the word', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();

    const text = await writePretty(workbook, (_wb, json) => {
      json.absent = undefined;
      json.present = 'here';
      // A lazy getter is the shape that surfaced this: the reader gives an imported VBA module a
      // `source` that materializes on read and is `undefined` when the module has none.
      Object.defineProperty(json, 'lazyAbsent', {
        enumerable: true, configurable: true, get: () => undefined
      });
    });

    // The bug wrote `"absent": undefined`, which is not JSON at all.
    expect(text).not.toContain('undefined');
    expect(() => JSON.parse(text)).not.toThrow();

    const parsed = JSON.parse(text);
    expect('absent' in parsed).toBe(false);
    expect('lazyAbsent' in parsed).toBe(false);
    // Dropped, not nulled: absent and null are different answers to several model readers.
    expect(parsed.absent).toBeUndefined();
    expect(parsed.present).toBe('here');
  });

  it('writes an undefined array position as null, as JSON.stringify does', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();

    const text = await writePretty(workbook, (_wb, json) => {
      json.holes = [1, undefined, 3];
    });

    expect(text).not.toContain('undefined');
    expect(JSON.parse(text).holes).toEqual([1, null, 3]);
  });

  it('still writes an ordinary workbook as parseable JSON', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getRange('Sheet1!A1').setValue(42);

    const text = await writePretty(workbook);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text).sheets).toBeDefined();
  });
});
