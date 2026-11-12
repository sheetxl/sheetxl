import React, { useEffect, useMemo, useReducer, useState } from 'react';

import type { RemoveListener } from '@sheetxl/utils';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const {
  CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider, useCommands
} = Command;

type Scope = InstanceType<typeof CommandScope>;
type Contribution = Command.CommandContribution;

/**
 * **The `useSheetCommands` recipe, proven on a slice before the 3363-line bulk port.** It exercises —
 * on a focused mock sheet — every "real" mechanism the monster has (everything else is repeated
 * execute patterns):
 *
 * - **Transactional middleware** (`doTransactionalCommand` → `contribution.use(tx)`): one cross-cutting
 *   wrapper does the batch/busy, so each command callback stays **pure**.
 * - **`mutator`-tag → protection reducer**: protecting the sheet disables every `mutator` command with
 *   an accumulated `disabledReason`; the non-mutator (view) command stays enabled.
 * - **Selection-shape disable**: `Sort` needs a single range; `Total Row` needs a table — contributor
 *   re-contributes `disabledReasons` on each model change.
 * - **Dynamic `state`**: `Bold` / `Total Row` reflect model state (pressed).
 * - **Container debounce**: the resolver coalesces rapid model ticks (the 210/120ms debounces become
 *   one `CommandAnchorProvider debounce`).
 *
 * Catalog (chrome+tags) is seeded at the root; behavior is one plain `contributeSheetSlice(contribution,
 * sheet)` bound at `createChild`. Keys mirror the real sheet so the read API is unchanged.
 */

// ── A focused mock of the bits of `IWorksheet` this slice touches ────────────────────────────────────
type Shape = 'cell' | 'range' | 'multi';
class MockSheet {
  shape: Shape = 'range';
  formatProtected = false;
  bold = false;
  hasTable = false;
  showTotals = false;
  busy: string | null = null;
  log: string[] = [];
  private _listeners = new Set<() => void>();

  subscribe(fn: () => void): RemoveListener { this._listeners.add(fn); return () => { this._listeners.delete(fn); }; }
  private _emit(): void { this._listeners.forEach((f) => f()); }

  // The transactional wrapper's model side: a batch with busy + an undo-log entry.
  async batch(description: string, work: () => void | Promise<void>): Promise<void> {
    this.busy = description; this._emit();
    try { await work(); this.log = [`✔ ${description}`, ...this.log].slice(0, 6); }
    finally { this.busy = null; this._emit(); }
  }

  // Pure mutations (no batching here — the middleware owns it).
  toggleBold(): void { this.bold = !this.bold; this._emit(); }
  fillDown(): void { /* fill work */ this._emit(); }
  sortAsc(): void { /* sort work */ this._emit(); }
  toggleTotals(): void { this.showTotals = !this.showTotals; this._emit(); }
  toggleGridlines(): void { /* view work */ this._emit(); }

  // UI-driven context changes (selection shape / protection / table presence).
  patch(p: Partial<Pick<MockSheet, 'shape' | 'formatProtected' | 'hasTable'>>): void { Object.assign(this, p); this._emit(); }
}

// ── Catalog: chrome + `mutator` tag, authored once (≈ SHEET_COMMAND_DEFINITIONS) ──────────────────
const SLICE: ReadonlyArray<{ key: string; label: string; icon: string; tags?: string[] }> = [
  { key: 'formatBoldToggle', label: 'Bold', icon: '𝐁', tags: ['mutator'] },
  { key: 'fillDown', label: 'Fill Down', icon: '⬇', tags: ['mutator'] },
  { key: 'sortAscending', label: 'Sort Asc', icon: '🔼', tags: ['mutator'] },
  { key: 'tableTotalRowToggle', label: 'Total Row', icon: 'Σ', tags: ['mutator', 'table'] },
  { key: 'gridlinesToggle', label: 'Gridlines', icon: '#' } // view — NOT a mutator
];
const isMutator = (key: string): boolean => !!SLICE.find((d) => d.key === key)?.tags?.includes('mutator');

const registerSheetSliceDefinitions = (root: Scope): void => {
  for (const d of SLICE) root.updateCommand(d.key, { label: d.label, icon: d.icon, tags: d.tags });
};

// ── Behavior: ONE plain contributor (≈ contributeSheetCommands) ─────────────────────────────
const contributeSheetSlice = (contribution: Contribution, sheet: MockSheet): RemoveListener => {
  // (1) The cross-cutting transactional wrapper — the `doTransactionalCommand` analog. Every callback
  // this scope authors is wrapped in a batch+busy; callbacks below stay pure.
  contribution.use((next) => async (args, command) => {
    await sheet.batch(command?.getLabel() ?? 'Command', async () => { await next(args, command); });
  });

  // (2) Pure callbacks (the mechanical bulk, in miniature).
  contribution.updateCommand('formatBoldToggle', { callback: () => sheet.toggleBold() });
  contribution.updateCommand('fillDown', { callback: () => sheet.fillDown() });
  contribution.updateCommand('sortAscending', { callback: () => sheet.sortAsc() });
  contribution.updateCommand('tableTotalRowToggle', { callback: () => sheet.toggleTotals() });
  contribution.updateCommand('gridlinesToggle', { callback: () => sheet.toggleGridlines() });

  // (3) Dynamic state + disable — recomputed (re-contributed) on every model change. `updateCommand`
  // merges, so this preserves the callbacks above. The protection rule is keyed on the `mutator` tag.
  const sync = (): void => {
    const protectedReason = (key: string): string[] => (sheet.formatProtected && isMutator(key) ? ['Sheet is protected'] : []);
    contribution.updateCommand<boolean>('formatBoldToggle', { state: sheet.bold, disabledReasons: protectedReason('formatBoldToggle') });
    contribution.updateCommand('fillDown', { disabledReasons: protectedReason('fillDown') });
    contribution.updateCommand('sortAscending', {
      disabledReasons: [...(sheet.shape === 'range' ? [] : ['Select a single range']), ...protectedReason('sortAscending')]
    });
    contribution.updateCommand<boolean>('tableTotalRowToggle', {
      state: sheet.showTotals,
      disabledReasons: [...(sheet.hasTable ? [] : ['No table selected']), ...protectedReason('tableTotalRowToggle')]
    });
  };
  sync(); // seed
  return sheet.subscribe(sync); // re-contribute on model ticks; the container debounce coalesces them
};

// Reads a command through the resolver and shows resolved state + accumulated reasons.
const CommandStatus: React.FC<{ commandKey: string }> = ({ commandKey }) => {
  const [cmd] = useCommands<boolean>(commandKey);
  const reasons = cmd?.disabledReasons() ?? [];
  const disabled = cmd?.disabled() ?? true;
  const state = cmd?.getState();
  return (
    <tr style={{ borderTop: '1px solid #eee' }}>
      <td style={{ padding: '3px 10px' }}>{cmd?.getLabel() ?? commandKey}</td>
      <td style={{ padding: '3px 10px' }}>{state === undefined ? '—' : <b>{state ? 'on' : 'off'}</b>}</td>
      <td style={{ padding: '3px 10px', fontWeight: 600, color: disabled ? '#e03131' : '#2f9e44' }}>{disabled ? 'disabled' : 'enabled'}</td>
      <td style={{ padding: '3px 10px', color: '#555' }}>{reasons.length ? reasons.join('  •  ') : '—'}</td>
    </tr>
  );
};

const Template: React.FC<any> = () => {
  const [, force] = useReducer((n) => n + 1, 0);

  const { root, sheet, tracker } = useMemo(() => {
    const sheet = new MockSheet();
    const root = new CommandScope('app');
    registerSheetSliceDefinitions(root);
    // Behavior bound to the `sheet` scope's lifetime (contributor + arg, no useEffect).
    const sheetScope = root.createChild('sheet', contributeSheetSlice, sheet);
    return { root, sheet, tracker: new ManualActivation(sheetScope) };
  }, []);

  // Re-render the surrounding chrome (log/busy) on model change — the commands re-resolve via the
  // resolver's own subscription independently.
  useEffect(() => sheet.subscribe(force), [sheet]);

  const [protectedOn, setProtectedOn] = useState(false);
  const [shape, setShape] = useState<Shape>('range');
  const [hasTable, setHasTable] = useState(false);

  return (
    <CommandScopeContext.Provider value={root}>
      {/* debounce: the 210/120ms selection debounces collapse to one container cadence. */}
      <CommandAnchorProvider tracker={tracker} debounce={150}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>useSheetCommands recipe — slice (middleware · mutator-disable · selection-shape · state)</h3>

          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
            {SLICE.map((d) => <CommandButton key={d.key} commandKey={d.key} />)}
            <span style={{ width: 1, height: 24, background: '#ddd' }} />
            <span style={{ color: sheet.busy ? '#d9480f' : '#aaa' }}>{sheet.busy ? `⏳ ${sheet.busy}…` : 'idle'}</span>
          </div>

          <div style={rowStyle}>
            <label style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={protectedOn} onChange={(e) => { setProtectedOn(e.target.checked); sheet.patch({ formatProtected: e.target.checked }); }} />
              {' '}Protect sheet <span style={{ color: '#888' }}>(disables <code>mutator</code> commands)</span>
            </label>
            <label style={{ marginLeft: 16 }}>
              Selection:{' '}
              <select value={shape} onChange={(e) => { const s = e.target.value as Shape; setShape(s); sheet.patch({ shape: s }); }}>
                <option value="cell">single cell</option>
                <option value="range">single range</option>
                <option value="multi">multi range</option>
              </select>{' '}
              <span style={{ color: '#888' }}>(Sort needs a single range)</span>
            </label>
            <label style={{ marginLeft: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={hasTable} onChange={(e) => { setHasTable(e.target.checked); sheet.patch({ hasTable: e.target.checked }); }} />
              {' '}Table selected <span style={{ color: '#888' }}>(Total Row needs a table)</span>
            </label>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, maxWidth: 640, border: '1px solid #e5e5ea', borderRadius: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '3px 10px' }}>command</th>
                <th style={{ padding: '3px 10px' }}>state</th>
                <th style={{ padding: '3px 10px' }}>enablement</th>
                <th style={{ padding: '3px 10px' }}>disabledReasons (accumulated)</th>
              </tr>
            </thead>
            <tbody>{SLICE.map((d) => <CommandStatus key={d.key} commandKey={d.key} />)}</tbody>
          </table>

          <div style={{ display: 'flex', gap: 24, color: '#888', fontSize: 14 }}>
            <span>undo log: <b style={{ color: '#222' }}>{sheet.log[0] ?? '—'}</b></span>
          </div>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>
            Click <b>Bold</b>/<b>Total Row</b> → toggles its <i>state</i>; every click logs a batch entry
            (the <code>use(tx)</code> middleware — callbacks stay pure). <b>Protect sheet</b> → all five
            except <i>Gridlines</i> disable with <b>"Sheet is protected"</b> (the <code>mutator</code>
            reducer). Change <b>Selection</b> away from a single range → <i>Sort</i> disables; toggle
            <b> Table selected</b> → <i>Total Row</i> enables. Stacked reasons accumulate (protect +
            shape). This is the whole sheet recipe; the rest is repetition.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const SheetCommands = asStory(Template);
SheetCommands.args = {};
SheetCommands.storyName = 'Sheet Commands (recipe slice)';

const Story = { title: 'Commands' };
export default Story;
