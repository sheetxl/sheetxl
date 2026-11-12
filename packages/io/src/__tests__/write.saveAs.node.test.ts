import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Workbook, WorkbookIO, WorkbookOrigin, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * Save As writes another file and moves the same workbook there. The origin it left keeps naming
 * the file it named; nothing about the workbook changes until the write succeeds.
 */

let dir: string;
let file: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheetxl-save-as-'));
  file = path.join(dir, 'report.csv');
  fs.writeFileSync(file, 'a,b\n1,2\n');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const createWorkbook = (): IWorkbook => {
  const workbook = new Workbook();
  workbook.getRange('A1').setValues([['value']]);
  return workbook;
};

describe('Save As (node files)', () => {

  it('moves the workbook to the new file and leaves the old origin as it was', async () => {
    const workbook = (await WorkbookIO.read(file))!;
    const before = workbook.getOrigin();
    const onOriginChange = vi.fn();
    workbook.addListeners({ onOriginChange });

    const written = await WorkbookIO.writeAs(workbook, path.join(dir, 'final.csv'));

    expect(workbook.getOrigin()).toBe(written);
    expect(written!.getPath()).toBe(path.join(dir, 'final.csv'));
    expect(written!.getFormat()).toBe((await WorkbookIO.getWriteFormats({ ext: 'csv' }))[0].key);
    expect(workbook.getName()).toBe('final');
    expect(before.getPath()).toBe(file);
    expect(onOriginChange).toHaveBeenCalledTimes(1);

    // The file it left is free: opening it again is not a copy.
    const reopened = (await WorkbookIO.read(file))!;
    expect(reopened.getOrigin().canWrite()).toBe(true);
    reopened.close();
    workbook.close();
  });

  it('refuses a Save As onto a file another open workbook saves back to, and stays put', async () => {
    const other = (await WorkbookIO.read(file))!;
    const workbook = createWorkbook();
    const before = workbook.getOrigin();

    await expect(WorkbookIO.writeAs(workbook, file)).rejects.toThrow(/open in another workbook/);
    expect(workbook.getOrigin()).toBe(before);

    other.close();
    workbook.close();
  });

  it('allows a Save As onto its own file', async () => {
    const workbook = (await WorkbookIO.read(file))!;

    const written = await WorkbookIO.writeAs(workbook, file);
    expect(workbook.getOrigin()).toBe(written);
    workbook.close();
  });

  it("records the file's modified time on read, and again on write", async () => {
    const workbook = (await WorkbookIO.read(file))!;
    expect(workbook.getOrigin().getLastModified()).toBe(fs.statSync(file).mtimeMs);

    const written = (await WorkbookIO.write(workbook))!;
    expect(written.getLastModified()).toBe(fs.statSync(file).mtimeMs);
    workbook.close();
  });

  it('an export writes a copy and leaves the workbook where it is', async () => {
    const workbook = (await WorkbookIO.read(file))!;
    const before = workbook.getOrigin();

    const written = await WorkbookIO.write(workbook, path.join(dir, 'export.csv'));
    expect(written).not.toBe(before);
    expect(workbook.getOrigin()).toBe(before);
    workbook.close();
  });
});

/**
 * A store that resolves every destination itself — the browser picker's shape — minting an origin
 * for it, and records what `encode` was told was being written.
 */
const mintingStore = (answer: string | null) => {
  const encoded: { origin?: IWorkbookIO.Origin }[] = [];
  WorkbookIO.setBackingStore({
    async write(request: IWorkbookIO.WriteRequest): Promise<IWorkbookIO.Origin | null> {
      if (!answer) return null; // the picker was dismissed
      const minted = new WorkbookOrigin(answer, { format: request.format.key, canWrite: true });
      encoded.push({ origin: minted });
      const bytes = await request.encode(request.format.key, minted);
      return bytes ? minted : null;
    }
  });
  return encoded;
};

describe('Save As (a store that resolves destinations)', () => {

  afterEach(() => {
    WorkbookIO.setBackingStore(null);
  });

  it('a first save moves an unbound workbook to the file it was saved to', async () => {
    mintingStore('Book1.csv');
    const workbook = createWorkbook();
    const unbound = workbook.getOrigin();

    const written = await WorkbookIO.write(workbook, { format: 'csv' });

    expect(workbook.getOrigin()).toBe(written);
    expect(unbound.getPath()).toBeNull();
    workbook.close();
  });

  it('a dismissed picker leaves the workbook where it was — nothing to undo', async () => {
    mintingStore(null);
    const workbook = createWorkbook();
    const before = workbook.getOrigin();

    expect(await WorkbookIO.writeAs(workbook, 'Book1.csv', { prompt: true })).toBeNull();
    expect(workbook.getOrigin()).toBe(before);
    workbook.close();
  });

  it('onWarnings sees the origin being written, not the one the workbook still lives in', async () => {
    mintingStore('picked.xlsx');
    const workbook = new Workbook();
    // A time period with no OOXML form — the xlsx writer drops the rule and warns.
    workbook.getWorksheets().getByName('Sheet1')!.getConditionalFormats()
      .add('A1:A5', { condition: { operator: 'timePeriod', param: { type: 'lastQuarter' } } } as any);
    const onWarnings = vi.fn(() => true);
    const before = workbook.getOrigin();

    const written = await WorkbookIO.write(workbook, { format: 'xlsx', onWarnings });

    const event = onWarnings.mock.calls[0][0] as unknown as IWorkbookIO.WriteWarningsEvent;
    expect(event.origin).toBe(written);
    expect(event.origin).not.toBe(before);
    expect(event.save).toBe(true);
    workbook.close();
  });
});
