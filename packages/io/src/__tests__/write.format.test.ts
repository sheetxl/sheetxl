import { afterEach, describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * `options.format` is a hint for when the destination's name says nothing. A name that already
 * names a different format is refused, never overridden.
 */

/** A store that persists nothing and records what it was asked to write. */
const captureStore = (): { writes: IWorkbookIO.WriteRequest[] } => {
  const writes: IWorkbookIO.WriteRequest[] = [];
  WorkbookIO.setBackingStore({
    async write(request: IWorkbookIO.WriteRequest): Promise<IWorkbookIO.Origin | null> {
      writes.push(request);
      const bytes = await request.encode(request.format.key);
      return bytes ? request.origin : null;
    }
  });
  return { writes };
};

/** CSV has nothing to write for an empty sheet, so every workbook here carries a value. */
const createWorkbook = (): IWorkbook => {
  const workbook = new Workbook();
  workbook.getRange('A1').setValues([['value']]);
  return workbook;
};

afterEach(() => {
  WorkbookIO.setBackingStore(null);
});

describe('write format vs destination extension', () => {

  it('refuses a format that contradicts the extension, before the store runs', async () => {
    const capture = captureStore();
    await expect(WorkbookIO.write(createWorkbook(), 'out/report.xlsx', { format: 'csv' }))
      .rejects.toThrow(/report\.xlsx/);
    expect(capture.writes).toHaveLength(0);
  });

  it('accepts a format that agrees with the extension, by extension or by key', async () => {
    const capture = captureStore();
    const format = (await WorkbookIO.getWriteFormats({ ext: 'xlsx' }))[0];
    expect(await WorkbookIO.write(createWorkbook(), 'out/a.xlsx', { format: 'xlsx' })).not.toBeNull();
    expect(await WorkbookIO.write(createWorkbook(), 'out/b.xlsx', { format: format.key })).not.toBeNull();
    expect(capture.writes.map(w => w.format.key)).toEqual([format.key, format.key]);
  });

  it('lets the format name an extensionless destination', async () => {
    captureStore();
    const written = await WorkbookIO.write(createWorkbook(), 'out/report', { format: 'csv' });
    expect(written?.getPath()).toMatch(/report\.csv$/);
  });

  it('lets the format decide when the extension names no known format', async () => {
    const capture = captureStore();
    expect(await WorkbookIO.write(createWorkbook(), 'out/report.bak', { format: 'csv' })).not.toBeNull();
    expect(capture.writes[0].format.exts).toContain('csv');
  });

  it('does not apply to a prompted save — the picker chooses the name', async () => {
    captureStore();
    expect(await WorkbookIO.write(createWorkbook(), { format: 'csv' })).not.toBeNull();
  });
});
