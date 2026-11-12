import { describe, it, expect } from 'vitest';

import { type ArgV } from '../Types';
import { run } from '../Runner';

/**
 * Source run through the runner is type-stripped and imported, never compiled to a macro, so the
 * runner itself keeps the promise the script declarations make: `SheetXL.<enum>` is a VALUE for
 * the length of the run, and gone afterwards.
 */
describe('Runner installs the SheetXL runtime global', () => {
  it('defines the enum constants during a run and removes them after', async () => {
    let seen: unknown;
    await run(null, undefined, {
      target: { runner: async () => { seen = (globalThis as any).SheetXL?.ISheet?.Visibility?.Hidden; } }
    });
    expect(seen).toBe('hidden');
    expect((globalThis as any).SheetXL).toBeUndefined();
  });

  it('removes the global when the run throws', async () => {
    const target = { runner: async () => { throw new Error('boom'); } };
    await expect(run(null, undefined, { target })).rejects.toThrow('boom');
    expect((globalThis as any).SheetXL).toBeUndefined();
  });

  it('covers module load — an inline script may read an enum at its top level', async () => {
    const code = [
      `const HIDDEN = SheetXL.ISheet.Visibility.Hidden;`,
      `export default async function main(ctx: any): Promise<void> { ctx.args.kv.seen = HIDDEN; }`,
    ].join('\n');
    // The script writes its reading back onto `args.kv` — the one channel a `void` entry has.
    const args: ArgV = { raw: [], kv: {}, _: [] };
    await run(null, args, { target: { code, filename: 'probe.ts' } });
    expect(args.kv.seen).toBe('hidden');
  });
});
