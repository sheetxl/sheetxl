import { describe, it, expect } from 'vitest';

import { type IWorkbook, Workbook, TransactionUndoManager } from '@sheetxl/sdk';

import { run } from '../Runner';

/**
 * A stage is one operation on the workbook it was handed.
 *
 * @remarks
 * The same contract the SDK's own script run has. It is what a script that writes a cell per call
 * depends on to stay linear, and what makes a run undo as a whole and leave nothing behind when it
 * throws half way.
 */
describe('run batches a stage', () => {

  const setup = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().start();
    return workbook;
  };

  it('undoes every write of a run as one step', async () => {
    const workbook = await setup();
    const undoManager = new TransactionUndoManager(workbook.getTransactions());
    await run(workbook, undefined, {
      target: {
        runner: (ctx) => {
          for (let r=1; r<=20; r++) {
            ctx.wb!.getRange(`Sheet1!A${r}`).setValue(r);
            ctx.wb!.getRange(`Sheet1!B${r}`).setValue(`=A${r}*2`);
          }
        }
      }
    });
    await workbook.whenCalculationReady();
    expect(workbook.getRange('Sheet1!B20').getValue()).toBe(40);

    undoManager.undo();
    await workbook.whenCalculationReady();
    expect(workbook.getRange('Sheet1!A1').getValue()).toBeNull();
    expect(workbook.getRange('Sheet1!B20').getValue()).toBeNull();
  });

  it('sees its own writes, and their results after a wait, while it runs', async () => {
    const workbook = await setup();
    const seen = await run(workbook, undefined, {
      target: {
        runner: async (ctx) => {
          ctx.wb!.getRange('Sheet1!A1').setValue(5);
          ctx.wb!.getRange('Sheet1!B1').setValue('=A1*2');
          const literal = ctx.wb!.getRange('Sheet1!A1').getValue();
          await ctx.wb!.whenCalculationReady();
          return [literal, ctx.wb!.getRange('Sheet1!B1').getValue()];
        }
      }
    });
    expect(seen).toEqual([5, 10]);
  });

  it('leaves nothing behind when the run throws', async () => {
    const workbook = await setup();
    workbook.getRange('Sheet1!A1').setValue('kept');
    await expect(run(workbook, undefined, {
      target: {
        runner: (ctx) => {
          ctx.wb!.getRange('Sheet1!A1').setValue('replaced');
          ctx.wb!.getRange('Sheet1!A2').setValue('added');
          throw new Error('stop');
        }
      }
    })).rejects.toThrow('stop');

    expect(workbook.getRange('Sheet1!A1').getValue()).toBe('kept');
    expect(workbook.getRange('Sheet1!A2').getValue()).toBeNull();
  });

  it('runs without a workbook as it always did', async () => {
    expect(await run(null, undefined, { target: { runner: (ctx) => ctx.wb } })).toBeNull();
  });
});
