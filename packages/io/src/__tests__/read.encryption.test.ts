import { afterEach, describe, expect, it, vi } from 'vitest';

import { InvalidPasswordError, PasswordRequiredError } from '@sheetxl/utils';

import { WorkbookIO, type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

import createSimpleWorkbook from './helpers/createSimpleWorkbook';

/**
 * A stand-in envelope: XOR-obfuscates bytes behind a marker.
 *
 * @remarks
 * The read layer's password handling (detect → prompt → retry → cancel) is independent of *how* an
 * envelope encrypts, so it is tested against a trivial one. This isolates the plumbing from
 * OFFCRYPTO's correctness — a bug in either shows up in exactly one suite instead of both.
 */
const MARKER = [0x54, 0x53, 0x54, 0x45]; // 'TSTE'

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

/** An encrypted `.sxl` payload — proving the envelope is not tied to any one format. */
const encryptedWorkbook = async (): Promise<ArrayBufferLike> => {
  const plain = await WorkbookIO.writeArrayBuffer(createSimpleWorkbook(), { format: 'SheetXL' });
  return testEncryption.encode(plain, PASSWORD);
}

const read = (bytes: ArrayBufferLike, options?: Partial<IWorkbookIO.ReadOptions>) =>
  WorkbookIO.read({ source: bytes, format: 'SheetXL', ...options });

afterEach(() => {
  WorkbookIO.setBackingStore(null);
});

describe('encrypted read', () => {

  it('opens with a password supplied up front', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });

    const workbook = await read(await encryptedWorkbook(), { password: PASSWORD });

    expect(workbook).not.toBeNull();
    expect(workbook!.getWorksheets().getByName('Sheet1')).toBeTruthy();
  });

  it('leaves unencrypted bytes untouched', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const plain = await WorkbookIO.writeArrayBuffer(createSimpleWorkbook(), { format: 'SheetXL' });

    const onPassword = vi.fn();
    const workbook = await read(plain, { onPassword });

    expect(workbook).not.toBeNull();
    expect(onPassword).not.toHaveBeenCalled();
  });

  it('prompts when no password was supplied', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const onPassword = vi.fn().mockResolvedValue(PASSWORD);

    const workbook = await read(await encryptedWorkbook(), { onPassword });

    expect(workbook).not.toBeNull();
    expect(onPassword).toHaveBeenCalledTimes(1);
    expect(onPassword.mock.calls[0][0]).toMatchObject({ encryption: 'test-envelope' });
  });

  it('retries in place via validate, and is invoked only once', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const onPassword = vi.fn(async ({ validate }: IWorkbookIO.PasswordRequest) => {
      expect(await validate('X')).toBe(false);
      expect(await validate(PASSWORD)).toBe(true);
      return PASSWORD;
    });

    const workbook = await read(await encryptedWorkbook(), { onPassword });

    expect(workbook).not.toBeNull();
    expect(onPassword).toHaveBeenCalledTimes(1);
  });

  it('does not re-decode a password already proven by validate', async () => {
    // The plaintext from a successful `validate` is reused, so an interactive retry costs exactly
    // one decode per password TRIED — never a extra one to re-confirm the accepted answer.
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const spy = vi.spyOn(testEncryption, 'decode');
    try {
      await read(await encryptedWorkbook(), {
        onPassword: async ({ validate }: IWorkbookIO.PasswordRequest) => {
          await validate(PASSWORD);
          return PASSWORD;
        }
      });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('prompts when an up-front password is wrong', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const onPassword = vi.fn().mockResolvedValue(PASSWORD);

    const workbook = await read(await encryptedWorkbook(), { password: 'wrong', onPassword });

    expect(workbook).not.toBeNull();
    expect(onPassword).toHaveBeenCalledTimes(1);
  });

  it('resolves to null when the prompt is cancelled', async () => {
    // Cancelling a password prompt is the same outcome as dismissing an open picker: nothing was
    // opened, and that is not an error.
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const onPassword = vi.fn().mockResolvedValue(null);

    const workbook = await read(await encryptedWorkbook(), { onPassword });

    expect(workbook).toBeNull();
    expect(onPassword).toHaveBeenCalledTimes(1);
  });

  it('throws when an unvalidated password is wrong', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });
    const onPassword = vi.fn().mockResolvedValue('wrong');

    await expect(read(await encryptedWorkbook(), { onPassword }))
      .rejects.toThrow(InvalidPasswordError);
    expect(onPassword).toHaveBeenCalledTimes(1);
  });

  it('throws PasswordRequiredError when no password and no prompt', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });

    await expect(read(await encryptedWorkbook())).rejects.toThrow(PasswordRequiredError);
  });

  it('records the envelope on the origin, and clears it for plaintext', async () => {
    await WorkbookIO.install({ name: 'test', register: (r) => r.registerEncryption(testEncryption) });

    const encrypted = await read(await encryptedWorkbook(), { password: PASSWORD });
    expect(encrypted!.getOrigin().getEncryption()).toEqual('test-envelope');

    const plain = await read(
      await WorkbookIO.writeArrayBuffer(createSimpleWorkbook(), { format: 'SheetXL' }));
    expect(plain!.getOrigin().getEncryption()).toBeNull();
  });
});
