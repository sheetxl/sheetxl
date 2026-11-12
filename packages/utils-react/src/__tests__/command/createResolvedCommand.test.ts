import { describe, it, expect, vi } from 'vitest';

import { type ICommandDefinition } from '../../command/ICommandDefinition';
import { reduceDefinitions } from '../../command/reduceDefinitions';
import { createResolvedCommand } from '../../command/createResolvedCommand';

/** Reduce (least→most specific) then resolve — the path the registry will take. */
function resolve(key: string, defs: ICommandDefinition[]) {
  return createResolvedCommand(reduceDefinitions(key, defs));
}

describe('createResolvedCommand', () => {
  it('exposes the reduced read surface (label/icon/key)', () => {
    const cmd = resolve('copy', [
      { key: 'copy', label: 'Copy', icon: 'copyIcon', callback: () => {} }
    ]);
    expect(cmd.getKey()).toBe('copy');
    expect(cmd.getLabel()).toBe('Copy');
    expect(cmd.getIcon()).toBe('copyIcon');
  });

  it('groupLabels override label for a given surface', () => {
    const cmd = resolve('renameSheet', [
      { key: 'renameSheet', label: 'Rename Sheet', groupLabels: { contextMenu: 'Rename' }, callback: () => {} }
    ]);
    expect(cmd.getLabel()).toBe('Rename Sheet');
    expect(cmd.getLabel('contextMenu')).toBe('Rename');
    expect(cmd.getLabel('toolbar')).toBe('Rename Sheet'); // falls back to label
  });

  it('resolves dynamic (function) values against context', () => {
    const cmd = resolve('bold', [
      {
        key: 'bold',
        context: { active: true } as any,
        label: ((c: any) => (c?.active ? 'Bold (on)' : 'Bold')) as any,
        callback: () => {}
      }
    ]);
    expect(cmd.getLabel()).toBe('Bold (on)');
  });

  it('disabled() derives from no-callback and from disabledReasons', async () => {
    const noCallback = resolve('x', [{ key: 'x', label: 'X' }]);
    expect(noCallback.disabled()).toBe(true); // no callback => disabled

    const ready = resolve('x', [{ key: 'x', callback: () => {} }]);
    expect(ready.disabled()).toBe(false);
    expect(ready.disabledReasons()).toEqual([]);

    const vetoed = resolve('x', [{ key: 'x', callback: () => {}, disabledReasons: ['sheet is protected'] }]);
    expect(vetoed.disabled()).toBe(true);
    expect(vetoed.disabledReasons()).toEqual(['sheet is protected']);
  });

  it('execute runs the resolved callback and resolves true', async () => {
    const cb = vi.fn();
    const cmd = resolve('copy', [{ key: 'copy', callback: cb }]);
    await expect(cmd.execute()).resolves.toBe(true);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('execute is a no-op when disabled', async () => {
    const cb = vi.fn();
    const cmd = resolve('copy', [{ key: 'copy', callback: cb, disabledReasons: ['protected'] }]);
    await expect(cmd.execute()).resolves.toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it('passes execute args (ARGS) independently of state (STATE)', async () => {
    let received: string | undefined;
    // STATE = the current font (output, for display); ARGS = the chosen font (input) — same
    // type here, opposite roles. See design/COMMAND-DESIGN.md "arg vs state".
    const cmd = createResolvedCommand<string, void, string>(
      reduceDefinitions<string, void, string>('font', [
        { key: 'font', state: 'Arial', callback: (args) => { received = args; } }
      ])
    );
    expect(cmd.getState()).toBe('Arial');   // output: the value the command reflects
    await cmd.execute('Calibri');           // input: the per-invocation payload
    expect(received).toBe('Calibri');
  });

  it('supports contributor-side middleware: the callback gets the command + is awaited in order', async () => {
    // A transaction-style shared wrapper the provider applies to its own (pure) callback.
    // Relies on: execute passing the resolved command as
    // the 2nd arg (so the wrapper can read getLabel) and awaiting the async callback in order.
    const order: string[] = [];
    let seenLabel: string | undefined;
    const tx = (raw: (a: any, c?: any) => Promise<void>) => async (args: any, command?: any): Promise<void> => {
      order.push('begin');
      seenLabel = command?.getLabel?.();
      await raw(args, command);
      order.push('commit');
    };

    const cmd = resolve('bold', [
      { key: 'bold', label: 'Bold', callback: tx(async () => { order.push('work'); }) }
    ]);
    await cmd.execute();

    expect(seenLabel).toBe('Bold');                        // wrapper read the label off the command arg
    expect(order).toEqual(['begin', 'work', 'commit']);    // wrapped + awaited in order
  });

  it('carries cascade provenance', () => {
    const cmd = resolve('copy', [
      { key: 'copy', label: 'Copy' },
      { key: 'copy', callback: () => {} }
    ]);
    expect(cmd.contributedBy.label).toBe(0);
    expect(cmd.contributedBy.callback).toBe(1);
  });
});
