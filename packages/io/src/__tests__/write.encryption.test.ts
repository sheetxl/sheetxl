import { afterEach, describe, expect, it } from 'vitest';

import { InvalidPasswordError, PasswordRequiredError } from '@sheetxl/utils';

import { Workbook, WorkbookIO, WorkbookOrigin, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { SXLPlugin } from '../formats';

// Deliberately NOT the full IOPlugin: installing only the SXL format leaves the stand-in envelope
// below as the only registered one, and proves the point of the whole design — encryption is
// format-independent, so it works with no xlsx support installed at all.
WorkbookIO.install(SXLPlugin);

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

const MARKER = [0x54, 0x53, 0x54, 0x45]; // 'TSTE'

/** The same trivial stand-in envelope the read tests use — see `read.encryption.test.ts`. */
const testEncryption: IWorkbookIO.EncryptionType = {
  key: 'test-envelope',
  description: 'Test Envelope',
  detect(bytes: ArrayBufferLike): boolean {
    if (bytes.byteLength < MARKER.length) return false;
    const view = new Uint8Array(bytes, 0, MARKER.length);
    return MARKER.every((b, i) => view[i] === b);
  },
  async decode(bytes: ArrayBufferLike, password: string): Promise<ArrayBufferLike> {
    const view = new Uint8Array(bytes);
    const key = view[MARKER.length];
    if (key !== (password.charCodeAt(0) & 0xff)) throw new InvalidPasswordError();
    const body = view.subarray(MARKER.length + 1);
    const out = new Uint8Array(body.byteLength);
    for (let i = 0; i < body.byteLength; i++) out[i] = body[i] ^ key;
    return out.buffer;
  },
  async encode(bytes: ArrayBufferLike, password: string): Promise<ArrayBufferLike> {
    const body = new Uint8Array(bytes);
    const key = password.charCodeAt(0) & 0xff;
    const out = new Uint8Array(MARKER.length + 1 + body.byteLength);
    out.set(MARKER);
    out[MARKER.length] = key;
    for (let i = 0; i < body.byteLength; i++) out[MARKER.length + 1 + i] = body[i] ^ key;
    return out.buffer;
  }
};

const PASSWORD = 'secret';

const install = () =>
  WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });

/** Captures the encoded bytes without touching a file system. */
const captureWrite = (): { bytes: () => ArrayBufferLike } => {
  let captured: ArrayBufferLike;
  WorkbookIO.setBackingStore({
    async write(request: IWorkbookIO.WriteRequest): Promise<IWorkbookIO.Origin> {
      captured = await request.encode(request.format.key);
      return request.origin;
    }
  });
  return { bytes: () => captured };
};

/** A workbook whose origin reports itself as encrypted, as one read from a protected file would. */
const openEncrypted = async (): Promise<IWorkbook> => {
  await install();
  const plain = await WorkbookIO.writeArrayBuffer(createSimpleWorkbook(), { format: 'SheetXL' });
  const encrypted = await testEncryption.encode(plain, PASSWORD);
  return (await WorkbookIO.read({ source: encrypted, format: 'SheetXL', password: PASSWORD }))!;
};

afterEach(() => {
  WorkbookIO.setBackingStore(null);
});

describe('encrypted write', () => {

  it('writes plaintext when nothing asks for encryption', async () => {
    await install();
    const capture = captureWrite();

    await WorkbookIO.write(createSimpleWorkbook(), 'plain.sxl');

    expect(testEncryption.detect(capture.bytes())).toBe(false);
  });

  it('encrypts when given a password, and records it on the handle', async () => {
    await install();
    const capture = captureWrite();

    const written = await WorkbookIO.write(createSimpleWorkbook(), 'secret.sxl', { password: PASSWORD });

    expect(testEncryption.detect(capture.bytes())).toBe(true);
    expect(written!.getEncryption()).toEqual('test-envelope');
  });

  it('re-encrypts a plain save using the password the file was opened with', async () => {
    // The payoff of the io layer remembering: Ctrl+S (and autosave) just work, and no host has to
    // hold the secret to make that true.
    const workbook = await openEncrypted();
    const capture = captureWrite();

    await WorkbookIO.write(workbook);

    expect(testEncryption.detect(capture.bytes())).toBe(true);
  });

  it('REFUSES to silently drop encryption when nothing is known', async () => {
    // The safety net: an encrypted destination with no password anywhere is an error, never a
    // quiet downgrade.
    await install();
    const workbook = new Workbook({ origin: new WorkbookOrigin('x.sxl', { encryption: 'test-envelope' }) });
    captureWrite();

    await expect(WorkbookIO.write(workbook)).rejects.toThrow(PasswordRequiredError);
  });

  it('setPassword(null) makes the next plain save write plaintext', async () => {
    // How "remove encryption" reaches a later save without the UI holding anything.
    const workbook = await openEncrypted();
    const capture = captureWrite();

    workbook.getOrigin().setPassword(null);
    await WorkbookIO.write(workbook);

    expect(testEncryption.detect(capture.bytes())).toBe(false);
    expect(workbook.getOrigin().getEncryption()).toBeNull();
  });

  it('setPassword records the intent on the handle immediately', async () => {
    // The handle answers "is or WILL BE encrypted" — the same latitude `setName` has — so chrome can
    // show a lock as soon as a password is set, with no second API to ask and no second signal to
    // watch.
    await install();
    const workbook = createSimpleWorkbook();
    expect(workbook.getOrigin().isEncrypted()).toBe(false);

    workbook.getOrigin().setPassword(PASSWORD);
    expect(workbook.getOrigin().isEncrypted()).toBe(true);

    workbook.getOrigin().setPassword(null);
    expect(workbook.getOrigin().isEncrypted()).toBe(false);
  });

  it('setPassword makes a plain save encrypt a workbook that never was', async () => {
    await install();
    const workbook = createSimpleWorkbook();
    const capture = captureWrite();

    workbook.getOrigin().setPassword(PASSWORD);
    await WorkbookIO.write(workbook);

    expect(testEncryption.detect(capture.bytes())).toBe(true);
  });

  it('carries the password to an explicit-target export', async () => {
    // An export mints a fresh target handle that carries nothing, so "I didn't say" would otherwise
    // mean "strip the protection" — a one-click way to undo it. `undefined` resolves against the
    // workbook's own handle instead.
    const workbook = await openEncrypted();
    const capture = captureWrite();

    const written = await WorkbookIO.write(workbook, 'copy.sxl');

    expect(testEncryption.detect(capture.bytes())).toBe(true);
    expect(written!.getEncryption()).toEqual('test-envelope');
  });

  it('exports an unprotected copy only when told to (password: null)', async () => {
    const workbook = await openEncrypted();
    const capture = captureWrite();

    await WorkbookIO.write(workbook, 'copy.sxl', { password: null });

    expect(testEncryption.detect(capture.bytes())).toBe(false);
    // An export never touches the workbook's own identity — it is still protected.
    expect(workbook.getOrigin().isEncrypted()).toBe(true);
  });

  it('re-encrypts a protected workbook when the password is supplied', async () => {
    const workbook = await openEncrypted();
    const capture = captureWrite();

    await WorkbookIO.write(workbook, undefined, { password: PASSWORD });

    expect(testEncryption.detect(capture.bytes())).toBe(true);
    expect(workbook.getOrigin().getEncryption()).toEqual('test-envelope');
  });

  it('removes encryption only when explicitly told to (password: null)', async () => {
    const workbook = await openEncrypted();
    const capture = captureWrite();

    await WorkbookIO.write(workbook, undefined, { password: null });

    expect(testEncryption.detect(capture.bytes())).toBe(false);
    // The handle must forget too, or the next save would demand a password for a plaintext file.
    expect(workbook.getOrigin().getEncryption()).toBeNull();
  });

  it('round-trips: what was written encrypted reads back', async () => {
    await install();
    const capture = captureWrite();
    await WorkbookIO.write(createSimpleWorkbook(), 'secret.sxl', { password: PASSWORD });
    WorkbookIO.setBackingStore(null);

    const reread = await WorkbookIO.read({
      source: capture.bytes(), format: 'SheetXL', password: PASSWORD
    });

    expect(reread).not.toBeNull();
    expect(reread!.getWorksheets().getByName('Sheet1')).toBeTruthy();
  });
});
