import { afterEach, describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

/** Gzip's magic number — the first two bytes of a compressed payload. */
const GZIP_MAGIC = [0x1f, 0x8b];

const firstBytes = (buffer: ArrayBufferLike, count: number): number[] =>
  Array.from(new Uint8Array(buffer).subarray(0, count));

/**
 * Captures the {@link IWorkbookIO.WriteRequest} a write produces without touching the file system,
 * so the IO layer's own decisions (resolved format, suggested name, encoded bytes) can be asserted
 * directly. Restored by the `afterEach` below.
 */
const captureWrite = (): { request: () => IWorkbookIO.WriteRequest } => {
  let captured: IWorkbookIO.WriteRequest;
  WorkbookIO.setBackingStore({
    async write(request: IWorkbookIO.WriteRequest): Promise<IWorkbookIO.Origin> {
      captured = request;
      // A real store resolves a destination before encoding; encode here so the bytes are asserted.
      await request.encode(request.format.key);
      return request.origin;
    }
  });
  return { request: () => captured };
};

afterEach(() => {
  WorkbookIO.setBackingStore(null);
});

describe('write format resolution', () => {

  it('defaults an unbound origin to sxl rather than throwing', async () => {
    // Regression: a plain Save of a new, never-saved workbook threw 'Unable to determine a write
    // format'. An unresolved destination means the store is about to prompt, so the format is only
    // the picker's default — not a decision the caller has to have made.
    const capture = captureWrite();
    const workbook: IWorkbook = new Workbook('Untitled');

    const written = await WorkbookIO.write(workbook);

    expect(written).not.toBeNull();
    expect(capture.request().format.key).toEqual('SheetXL');
    expect(capture.request().suggestedName).toEqual('Untitled.sxl');
  });

  it('resolves an export target with no extension to sxl', async () => {
    // Previously unreachable: no extension meant no format, which threw before the code that
    // completes the target's name could run.
    const capture = captureWrite();
    const workbook: IWorkbook = new Workbook();

    const written = await WorkbookIO.write(workbook, 'copy');

    expect(written?.getPath()).toEqual('copy.sxl');
    expect(capture.request().format.key).toEqual('SheetXL');
  });

  it('still throws for a bound, writable destination with an unknown extension', async () => {
    // A bound destination gets no second chance from a picker, so an unresolvable extension stays
    // an error rather than being silently written as something else.
    captureWrite();
    const workbook: IWorkbook = new Workbook();

    await expect(WorkbookIO.write(workbook, './out/report.unknown')).rejects.toThrow();
  });
});

describe('SheetXL vs JSON formats', () => {

  it('compresses .sxl and leaves .json readable', async () => {
    const workbook = createSimpleWorkbook();

    const sxl = await WorkbookIO.writeArrayBuffer(workbook, { format: 'SheetXL' });
    const json = await WorkbookIO.writeArrayBuffer(workbook, { format: 'JSON' });

    expect(firstBytes(sxl, 2)).toEqual(GZIP_MAGIC);
    // '{' — plain, pretty-printed JSON, and never gzip.
    expect(firstBytes(json, 1)).toEqual([0x7b]);
    expect(new TextDecoder().decode(json)).toContain('\n');
  });

  it('resolves the format from the destination extension', async () => {
    const capture = captureWrite();
    const workbook: IWorkbook = new Workbook();

    await WorkbookIO.write(workbook, './out/report.json');
    expect(capture.request().format.key).toEqual('JSON');

    await WorkbookIO.write(workbook, './out/report.sxl');
    expect(capture.request().format.key).toEqual('SheetXL');
  });

  it('reads both formats back regardless of how they were encoded', async () => {
    // The reader sniffs the gzip magic number, so a hand-renamed file still opens. Only the write
    // side is opinionated.
    const workbook = createSimpleWorkbook();
    const expected = workbook.getWorksheets().getByName('Sheet1')!.getRange('A1').getCell().getValue();

    for (const format of ['SheetXL', 'JSON']) {
      const bytes = await WorkbookIO.writeArrayBuffer(workbook, { format });
      const reread = (await WorkbookIO.read({ source: bytes, format }))!;
      expect(reread.getWorksheets().getByName('Sheet1')!.getRange('A1').getCell().getValue())
        .toEqual(expected);
    }
  });

  it('honours an explicit compress option over the format default', async () => {
    const workbook = createSimpleWorkbook();

    const json = await WorkbookIO.writeArrayBuffer(workbook, { format: 'JSON', compress: true } as any);

    expect(firstBytes(json, 2)).toEqual(GZIP_MAGIC);
  });
});
