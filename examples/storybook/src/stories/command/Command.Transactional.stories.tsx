import React, { useEffect, useMemo, useReducer } from 'react';

import { UndoManager } from '@sheetxl/utils';

import { type ITransaction } from '@sheetxl/sdk';

import { Command } from '@sheetxl/utils-react';

import { contributeUndoCommands, createTransactionalMiddleware } from '@sheetxl/react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

// Undo/redo chrome now lives in the command catalog (fetched at runtime). Story-local synchronous seed.
const seedUndoChrome = (target: { updateCommand: (key: string, partial: any) => void }): void => {
  target.updateCommand('undo', { label: 'Undo', shortcut: { key: 'z', modifiers: ['ctrl'] } });
  target.updateCommand('redo', { label: 'Redo', shortcut: { key: 'y', modifiers: ['ctrl'] } });
};

const { CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider } = Command;
type Contribution = Command.CommandContribution;

/**
 * **The shared transactional middleware + "repeat last action", proven against the undo port.**
 * `createTransactionalMiddleware` (the `doTransactionalCommand` replacement) is contributed once on the
 * `sheet` scope via `contribution.use(...)`; its commands' callbacks stay **pure** while the middleware
 * adds batch + (here, no notifier) + **repeatable**.
 *
 * Repeat composes with `contributeUndoCommands`: after a command runs, the middleware sets the undo
 * manager's *repeatable operation*; `UndoManager.redo()` falls back to it when the redo stack is empty,
 * and our `redo` command stays enabled (its `hasRedo()` counts the repeat op) — so **Redo / Ctrl+Y / F4
 * re-runs the last action against the *current* state**. Re-running re-arms it (repeat-after-repeat).
 */

// A tiny model that is its own transaction boundary (the real `sheet` is an `ITransaction.ITransactional`).
// `doBatch` snapshots before/after and records one undo entry — so undo/redo and repeat all work.
class Model {
  value = 0;
  color = 'none';
  private _listeners = new Set<() => void>();
  constructor(private _manager: UndoManager) {}
  subscribe(fn: () => void): () => void { this._listeners.add(fn); return () => { this._listeners.delete(fn); }; }
  private _emit(): void { this._listeners.forEach((f) => f()); }

  async doBatch(work: () => unknown, description?: string): Promise<void> {
    const before = { value: this.value, color: this.color };
    await work();
    const after = { value: this.value, color: this.color };
    this._manager.addUndoOperation({
      description: description ?? 'Edit',
      undo: () => {
        this.value = before.value; this.color = before.color; this._emit();
        return () => { this.value = after.value; this.color = after.color; this._emit(); };
      }
    });
    this._emit();
  }

  // Pure mutations — the middleware owns the batch.
  increment(): void { this.value += 1; }
  fill(color: string): void { this.color = color; }
}

// A demo feature contributor: the shared factory + three pure callbacks (≈ a slice of contributeSheetCommands).
const contributeDemoCommands = (contribution: Contribution, model: Model, manager: UndoManager): void => {
  contribution.use(createTransactionalMiddleware({ transaction: model as unknown as ITransaction.ITransactional, manager }));
  contribution.updateCommand('increment', { callback: () => model.increment() });
  contribution.updateCommand('fillRed', { callback: () => model.fill('crimson') });
  contribution.updateCommand('fillBlue', { callback: () => model.fill('royalblue') });
};

const Template: React.FC<any> = () => {
  const [, force] = useReducer((n) => n + 1, 0);

  const { root, model, manager, tracker } = useMemo(() => {
    const manager = new UndoManager();
    const model = new Model(manager);
    const root = new CommandScope('app');
    seedUndoChrome(root);                                   // undo/redo chrome (story-local seed)
    root.updateCommand('increment', { label: 'Increment', icon: '➕' });
    root.updateCommand('fillRed', { label: 'Fill Red', icon: '🟥' });
    root.updateCommand('fillBlue', { label: 'Fill Blue', icon: '🟦' });
    const undo = root.createChild('undo', contributeUndoCommands, { manager });      // undo behavior
    const sheet = undo.createChild('sheet', contributeDemoCommands, model, manager); // factory + callbacks
    return { root, model, manager, tracker: new ManualActivation(sheet) };
  }, []);

  useEffect(() => model.subscribe(force), [model]);
  useEffect(() => manager.addListener({ onStackChange: force }), [manager]);

  return (
    <CommandScopeContext.Provider value={root}>
      <CommandAnchorProvider tracker={tracker}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Transactional middleware + repeat last action</h3>

          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
            <CommandButton commandKey="increment" />
            <CommandButton commandKey="fillRed" />
            <CommandButton commandKey="fillBlue" />
            <span style={{ width: 1, height: 24, background: '#ddd' }} />
            <CommandButton commandKey="undo" />
            <CommandButton commandKey="redo" />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#888', fontSize: 14 }}>
            <span>value: <b style={{ color: '#222' }}>{model.value}</b></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              color: <span style={{ width: 16, height: 16, borderRadius: 3, border: '1px solid #ccc', background: model.color === 'none' ? 'transparent' : model.color }} />
              <b style={{ color: '#222' }}>{model.color}</b>
            </span>
            <span>top undo: <b style={{ color: '#222' }}>{manager.getTopUndoDescription() ?? '—'}</b></span>
            <span>top redo / repeat: <b style={{ color: '#222' }}>{manager.getTopRedoDescription() ?? '—'}</b></span>
          </div>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5, maxWidth: 680 }}>
            Click <b>Increment</b> → value rises, one undo entry per click (the <code>use(tx)</code> batch —
            callbacks are pure). <b>Undo</b>/<b>Redo</b> work normally. Now the key bit: after any action the
            <b> Redo</b> button stays enabled showing <b>"Redo &lt;action&gt;"</b> even with nothing to redo —
            because the middleware armed the manager's <i>repeatable operation</i>. Click <b>Redo</b> (or
            press <code>Ctrl+Y</code> / <code>F4</code>) → it <b>repeats the last action</b> against the
            current value. Switch between <i>Increment</i> and <i>Fill</i> to see the repeat target follow
            the most recent action.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const Transactional = asStory(Template);
Transactional.args = {};
Transactional.storyName = 'Transactional + Repeat';

const Story = { title: 'Commands' };
export default Story;
