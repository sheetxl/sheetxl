import { describe, it, expect } from 'vitest';

import { type IWorkbook, Workbook } from '@sheetxl/sdk';

import { run } from '../Runner';

/**
 * `run` hands back what the entry returned, undisturbed.
 *
 * @remarks
 * It used to hand back the WORKBOOK: the pipeline kept a returned `IWorkbook` and dropped every
 * other return value, so a script ending in `return answers` printed nothing on the CLI while the
 * identical snippet printed its final expression. These pin the contract `RunFunction` states —
 * the return value IS the result, whatever its shape, with no inspection but the one that threads
 * a workbook to the next stage.
 */
describe('run returns the entry result', () => {
  it('carries a plain value back', async () => {
    expect(await run(null, undefined, { target: { runner: () => [1, 2, 3] } })).toEqual([1, 2, 3]);
  });

  it('carries an async entry result back', async () => {
    expect(await run(null, undefined, { target: { runner: async () => 42 } })).toBe(42);
  });

  it('reports nothing as undefined rather than as a value', async () => {
    expect(await run(null, undefined, { target: { runner: () => {} } })).toBeUndefined();
  });

  it('carries a module default export result back — the `-e`/`-f` shape', async () => {
    const code = `export default function main(ctx: any): number[] { return [1, 2, 3]; }`;
    expect(await run(null, undefined, { target: { code, filename: 'probe.ts' } })).toEqual([1, 2, 3]);
  });

  it('passes args through to the context', async () => {
    const args = { raw: ['--region', 'EU'], kv: { region: 'EU' }, _: [] };
    const seen = await run(null, args, { target: { runner: (ctx) => ctx.args.kv.region } });
    expect(seen).toBe('EU');
  });

  describe('a pipeline', () => {
    it('answers with the LAST stage — one question asked in stages', async () => {
      const result = await run(null, undefined, {
        target: [{ runner: () => 'first' }, { runner: () => 'second' }]
      });
      expect(result).toBe('second');
    });

    it('ends silent when the last stage returns nothing, even after one answered', async () => {
      const result = await run(null, undefined, {
        target: [{ runner: () => 'first' }, { runner: () => {} }]
      });
      expect(result).toBeUndefined();
    });
  });

  describe('a returned workbook', () => {
    it('comes back as the result — a snippet ending in `wb` renders it too', async () => {
      const wb = new Workbook();
      expect(await run(wb, undefined, { target: { runner: (ctx) => ctx.wb } })).toBe(wb);
    });

    it('replaces the workbook the next stage runs against', async () => {
      const first = new Workbook();
      const second = new Workbook();
      const result = await run(first, undefined, {
        target: [
          { runner: () => second },
          // `ctx.wb` is the stage's batch-bound view of the workbook, so it is told by what it writes.
          { runner: (ctx) => { ctx.wb!.getSelectedWorksheet()!.getRange('A1').setValue('second'); return 'done'; } },
        ]
      });
      expect(second.getSelectedWorksheet()!.getRange('A1').getValue()).toBe('second');
      expect(first.getSelectedWorksheet()!.getRange('A1').getValue()).toBeNull();
      // The workbook threaded, but the ANSWER is still the last stage's.
      expect(result).toBe('done');
    });

    it('is not invented when the entry returned something else', async () => {
      const wb = new Workbook();
      const result = await run(wb, undefined, { target: { runner: () => 'tally' } });
      // The caller keeps the workbook it passed in; nothing about it comes back in the result.
      expect(result).toBe('tally');
      expect((result as unknown as IWorkbook)?.isIWorkbook).toBeUndefined();
    });
  });
});
