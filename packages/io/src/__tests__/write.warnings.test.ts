import { afterEach, describe, expect, it, vi } from 'vitest';

import { Workbook, WorkbookIO, WorkbookOrigin, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * Write warnings: what a format cannot hold is reported ONCE per finding, after the bytes exist and
 * before anything is persisted, and the caller decides whether a silent re-save goes ahead.
 */

/** A conditional format whose time period has no OOXML form — the xlsx writer skips the rule. */
const LOSSY_RULE = { condition: { operator: 'timePeriod', param: { type: 'lastQuarter' } } } as any;

/** The same lossy rule on two sheets: two emit-site warnings, one finding. */
const createLossyWorkbook = (): IWorkbook => {
  const workbook = new Workbook();
  workbook.getWorksheets().getByName('Sheet1')!.getConditionalFormats().add('A1:A5', LOSSY_RULE);
  workbook.getWorksheets().add({ name: 'Second' }).getConditionalFormats().add('B1:B5', LOSSY_RULE);
  return workbook;
};

/**
 * A store that encodes and persists nothing: what `encode` returned is the whole record of whether
 * the write went ahead.
 */
const captureStore = (): { bytes: () => ArrayBufferLike | null | undefined } => {
  let bytes: ArrayBufferLike | null | undefined;
  WorkbookIO.setBackingStore({
    async write(request: IWorkbookIO.WriteRequest): Promise<IWorkbookIO.Origin | null> {
      bytes = await request.encode(request.format.key);
      return bytes ? request.origin : null;
    }
  });
  return { bytes: () => bytes };
};

afterEach(() => {
  WorkbookIO.setBackingStore(null);
});

describe('write warnings', () => {

  it('reports a lossy rule once, however many sheets carry it', async () => {
    const onWarning = vi.fn();
    await WorkbookIO.writeArrayBuffer(createLossyWorkbook(), { format: 'xlsx', progress: { onWarning } });

    expect(onWarning).toHaveBeenCalledTimes(1);
    const [message, context] = onWarning.mock.calls[0];
    expect(message).toMatch(/lastQuarter/);
    // The first context wins; it is a locator (the part path), not part of the finding.
    expect(context).toMatch(/worksheets\/sheet1\.xml$/);
  });

  it('asks once, with the whole list, and a declined silent re-save persists nothing', async () => {
    const capture = captureStore();
    const onWarnings = vi.fn(() => false);

    // An explicit target minted from a string is bound and writable — the store would overwrite it
    // without asking, which is the one case a lossy write can be cancelled.
    const workbook = createLossyWorkbook();
    const written = await WorkbookIO.write(workbook, 'out/lossy.xlsx', { onWarnings });

    expect(written).toBeNull();
    expect(capture.bytes()).toBeNull();
    expect(onWarnings).toHaveBeenCalledTimes(1);
    const event = onWarnings.mock.calls[0][0] as unknown as IWorkbookIO.WriteWarningsEvent;
    expect(event.warnings).toHaveLength(1);
    expect(event.workbook).toBe(workbook);
    expect(event.canCancel).toBe(true);
    expect(event.save).toBe(false);
    // The origin is the file being written, so its format is the one the bytes are in.
    expect(event.origin.getFormat()).toBe((await WorkbookIO.getWriteFormats({ ext: 'xlsx' }))[0].key);
  });

  it('a prompted write goes ahead even when declined', async () => {
    const capture = captureStore();
    const onWarnings = vi.fn(() => false);

    // Unbound origin: the store is about to resolve a destination, so there is nothing to protect.
    const written = await WorkbookIO.write(createLossyWorkbook(), { format: 'xlsx', onWarnings });

    expect(written).not.toBeNull();
    expect(capture.bytes()).toBeTruthy();
    expect(onWarnings).toHaveBeenCalledTimes(1);
    const event = onWarnings.mock.calls[0][0] as unknown as IWorkbookIO.WriteWarningsEvent;
    expect(event.canCancel).toBe(false);
    expect(event.save).toBe(true);
  });

  it('does not ask again for what a save to the same file already let through', async () => {
    captureStore();
    const onWarnings = vi.fn(() => true);
    const bound = new Workbook({ origin: new WorkbookOrigin('out/kept.xlsx', { canWrite: true }) });
    const formats = bound.getWorksheets().getByName('Sheet1')!.getConditionalFormats();
    formats.add('A1:A5', LOSSY_RULE);

    await WorkbookIO.write(bound, { onWarnings });
    await WorkbookIO.write(bound, { onWarnings });
    expect(onWarnings).toHaveBeenCalledTimes(1);

    // Something new to lose asks again, with the whole list.
    formats.add('C1:C5', { condition: { operator: 'not', param: LOSSY_RULE.condition } } as any);
    await WorkbookIO.write(bound, { onWarnings });
    expect(onWarnings).toHaveBeenCalledTimes(2);
    const event = onWarnings.mock.calls[1][0] as unknown as IWorkbookIO.WriteWarningsEvent;
    expect(event.warnings.length).toBeGreaterThan(1);

    bound.close();
  });

  it('a declined save is not remembered as let through', async () => {
    captureStore();
    const onWarnings = vi.fn(() => false);
    const bound = new Workbook({ origin: new WorkbookOrigin('out/declined.xlsx', { canWrite: true }) });
    bound.getWorksheets().getByName('Sheet1')!.getConditionalFormats().add('A1:A5', LOSSY_RULE);

    await WorkbookIO.write(bound, { onWarnings });
    await WorkbookIO.write(bound, { onWarnings });
    expect(onWarnings).toHaveBeenCalledTimes(2);
    bound.close();
  });

  it('does not ask when nothing was lost', async () => {
    captureStore();
    const onWarnings = vi.fn(() => false);

    const written = await WorkbookIO.write(new Workbook(), 'out/plain.xlsx', { onWarnings });

    expect(written).not.toBeNull();
    expect(onWarnings).not.toHaveBeenCalled();
  });
});
