import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { WorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * A file is saved back by one open workbook at a time. Opening it again is fine — the second
 * workbook is a copy, with a read-only origin — but nothing may write over a file another open
 * workbook saves back to.
 */

let dir: string;
let file: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheetxl-already-open-'));
  file = path.join(dir, 'report.csv');
  fs.writeFileSync(file, 'a,b\n1,2\n');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('opening a file that is already open', () => {

  it('opens it again as a read-only copy', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(file))!;

    expect(original.getOrigin().canWrite()).toBe(true);
    expect(copy.getOrigin()).not.toBe(original.getOrigin());
    expect(copy.getOrigin().getPath()).toBe(original.getOrigin().getPath());
    expect(copy.getOrigin().canWrite()).toBe(false);
    expect(copy.getRange('B2').getValues()).toEqual(original.getRange('B2').getValues());

    original.close();
    copy.close();
  });

  it('treats a differently spelled path to the same file as the same file', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(path.join(dir, '.', 'report.csv')))!;

    expect(copy.getOrigin().canWrite()).toBe(false);
    original.close();
    copy.close();
  });

  it('opens it writable again once the other workbook closes', async () => {
    const first = (await WorkbookIO.read(file))!;
    first.close();

    const again = (await WorkbookIO.read(file))!;
    expect(again.getOrigin().canWrite()).toBe(true);
    again.close();
  });

  it('reads an origin handle already in use as a copy with an origin of its own', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(original.getOrigin()))!;

    expect(copy.getOrigin()).not.toBe(original.getOrigin());
    expect(copy.getOrigin().canWrite()).toBe(false);
    original.close();
    copy.close();
  });

  it('opens a copy on request even when the file is not open', async () => {
    const copy = (await WorkbookIO.read({ source: file, asCopy: true }))!;
    expect(copy.getOrigin().canWrite()).toBe(false);

    // A copy does not hold the file, so a normal open alongside it is writable.
    const original = (await WorkbookIO.read(file))!;
    expect(original.getOrigin().canWrite()).toBe(true);
    copy.close();
    original.close();
  });

  it('does not apply to sources with no file behind them', async () => {
    const bytes = fs.readFileSync(file);
    const a = (await WorkbookIO.read({ source: bytes, format: 'csv' }))!;
    const b = (await WorkbookIO.read({ source: bytes, format: 'csv' }))!;

    expect(a.getOrigin().getPath()).toBeNull();
    expect(b.getOrigin().getPath()).toBeNull();
    a.close();
    b.close();
  });
});

describe('writing onto a file another open workbook saves back to', () => {

  it('refuses, and leaves the file as it was', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(file))!;
    copy.getRange('A1').setValues([['changed']]);
    const before = fs.readFileSync(file, 'utf8');

    await expect(WorkbookIO.write(copy, file)).rejects.toThrow(/open in another workbook/);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);

    original.close();
    copy.close();
  });

  it('lets the workbook that owns the file save it', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(file))!;

    expect(await WorkbookIO.write(original)).not.toBeNull();

    original.close();
    copy.close();
  });

  it('allows the write once the owning workbook closes', async () => {
    const original = (await WorkbookIO.read(file))!;
    const copy = (await WorkbookIO.read(file))!;
    original.close();

    expect(await WorkbookIO.write(copy, file)).not.toBeNull();
    copy.close();
  });
});
