import React, { useEffect, useMemo, useReducer, useState } from 'react';

import type { RemoveListener, EditMode, EditModeHandler } from '@sheetxl/utils';

import { Command } from '@sheetxl/utils-react';

import { contributeClipboardCommands } from '@sheetxl/react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const {
  CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider, useCommands
} = Command;

type Scope = InstanceType<typeof CommandScope>;

/**
 * **The Batch-2 clipboard port, proven on a slice** — `contributeClipboardCommands` (the fold of the
 * infra `useCopyPaste` + sheet `useSheetCopyPaste`) run against light fakes, exercising the mechanics
 * that don't need the real SDK:
 *
 * - **Cut** writes the fake clipboard, which fires
 *   `clipboardchange`; the contributor's listener republishes the copied reference onto the **edit-mode
 *   bus**. The command-free `SheetClipboardLayer` reads that same bus — here the "marquee" row shows
 *   the active mode (`copy` / `cut` / `formatPainter`) the marching-ants would draw from.
 * - **Protection disable owned here.** `cut`/`paste`/`pasteX` are NOT `mutator`-tagged (copy stays
 *   enabled), so this contributor disables them directly when the sheet is format-protected.
 * - **`formatPainterToggle` = copy-with-a-mode.** Clicking it publishes a `formatPainter` edit mode
 *   (its `state` reflects the bus); clicking again clears it. This is the unblock the batch delivers.
 *
 * The contributor is re-run whenever the bus changes (mirroring the bridge), so `formatPainter`'s
 * `state` re-syncs. Real copy/paste I/O is covered in-app.
 */

// ── Chrome (≈ the SHEET_COMMAND_DEFINITIONS entries for these keys) ────────────────────────────────
const CLIPBOARD_KEYS: ReadonlyArray<{ key: string; label: string; icon: string }> = [
  { key: 'cut', label: 'Cut', icon: '✂' },
  { key: 'copy', label: 'Copy', icon: '⧉' },
  { key: 'paste', label: 'Paste', icon: '📋' },
  { key: 'pasteValues', label: 'Paste Values', icon: '1' },
  { key: 'pasteFormats', label: 'Paste Formatting', icon: '🎨' },
  { key: 'pasteFormulas', label: 'Paste Formulas', icon: 'ƒ' },
  { key: 'pasteTranspose', label: 'Paste Transpose', icon: '⇄' },
  { key: 'pasteLinks', label: 'Paste Links', icon: '🔗' },
  { key: 'formatPainterToggle', label: 'Format Painter', icon: '🖌' }
];

const registerClipboardChrome = (root: Scope): void => {
  for (const d of CLIPBOARD_KEYS) root.updateCommand(d.key, { label: d.label, icon: d.icon });
};

// ── A fake edit-mode bus backed by React state (so the story re-renders + re-contributes) ──────────
const useMockEditMode = (): [EditMode | null, EditModeHandler] => {
  const [mode, setMode] = useState<EditMode | null>(null);
  const handler = useMemo<EditModeHandler>(() => ({
    getMode: () => mode,
    setMode: (value) => setMode((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      prev?.onModeChange?.(next ?? null);
      return next;
    })
  }), [mode]);
  return [mode, handler];
};

// ── A fake clipboard: stores the last reference, fires clipboardchange (the real event contract) ───
class MockClipboard {
  private _ref: any = null;
  private _listeners = new Map<string, Set<(e: Event) => void>>();
  addEventListener(type: string, fn: (e: Event) => void): void { (this._listeners.get(type) ?? this._listeners.set(type, new Set()).get(type)!).add(fn); }
  removeEventListener(type: string, fn: (e: Event) => void): void { this._listeners.get(type)?.delete(fn); }
  private _emit(type: string): void { this._listeners.get(type)?.forEach((fn) => fn(new Event(type))); }
  async writeReference(ref: any): Promise<void> { this._ref = ref; this._emit('clipboardchange'); }
  async writeText(_text: string): Promise<void> { this._ref = null; this._emit('clipboardchange'); }
  async readReference(): Promise<any> { return this._ref; }
  clear(): void { this._ref = null; this._emit('clipboardchange'); }
}

// ── A fake sheet: only the members the clipboard contributor touches at contribute/copy time ───────
const makeMockSheet = (getProtected: () => boolean) => {
  const coords = { rowStart: 0, colStart: 0, rowEnd: 2, colEnd: 2 };
  const sheet: any = {
    // copy path: getSelectedRanges().getSnapshot(opts) → a snapshot carrying the copy opts as markOptions
    getSelectedRanges: () => ({
      getSnapshot: (opts: any) => ({
        getMarkOptions: () => opts ?? {},
        getName: () => 'Range',
        getCoords: () => coords,
        getSource: () => sheet,
        toText: () => 'A1:C3',
        toHtml: () => '<table/>'
      }),
      getCoords: () => [coords],
      getCount: () => 1
    }),
    getSelectedRange: () => ({ getTopLeft: () => ({ getCoords: () => ({ colStart: 0, rowStart: 0 }) }), size: 1 }),
    getProtection: () => ({ isFormatCellsAllowed: () => !getProtected() }),
    getRuntime: () => ({}),
    getStyles: () => ({}),
    addListeners: (_l: any): RemoveListener => () => {}
  };
  return sheet;
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
  const [protectedOn, setProtectedOn] = useState(false);
  const [mode, editModeHandler] = useMockEditMode();

  // Protection read live by the contributor; `force` re-runs the disable reducer via the sheet listener
  // in the real app — here we just re-render (the contributor re-runs from the effect below on toggle).
  const { root, sheet, clipboard, tracker } = useMemo(() => {
    const root = new CommandScope('app');
    registerClipboardChrome(root);
    const sheetScope = root.createChild('sheet');
    const clipboard = new MockClipboard();
    const sheet = makeMockSheet(() => protectedOnRef.current);
    return { root, sheet, clipboard, sheetScope, tracker: new ManualActivation(sheetScope) };
  }, []);

  // Keep a ref so the memoized fake sheet reads the live protection flag.
  const protectedOnRef = React.useRef(protectedOn);
  protectedOnRef.current = protectedOn;

  // Re-run the REAL contributor whenever the bus (or protection) changes — mirrors the bridge, so
  // formatPainter's `state` and the paste-disable stay in sync.
  const sheetScope = (root as any).getChild('sheet') as Scope;
  useEffect(() => {
    const contribution = sheetScope.contribution();
    const dispose = contributeClipboardCommands(contribution, {
      sheet,
      editModeHandler,
      globalClipboard: { getClipboard: () => clipboard as any },
      element: () => document.body
    });
    return () => { dispose(); contribution.remove(); };
  }, [sheetScope, sheet, clipboard, editModeHandler, protectedOn]);

  return (
    <CommandScopeContext.Provider value={root}>
      <CommandAnchorProvider tracker={tracker} debounce={100}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Clipboard commands — copy→marquee · protection-disable · format painter</h3>

          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px', flexWrap: 'wrap' }}>
            {CLIPBOARD_KEYS.map((d) => <CommandButton key={d.key} commandKey={d.key} />)}
          </div>

          <div style={rowStyle}>
            <label style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={protectedOn} onChange={(e) => { setProtectedOn(e.target.checked); force(); }} />
              {' '}Protect sheet <span style={{ color: '#888' }}>(disables cut / paste / pasteX — <b>copy stays enabled</b>)</span>
            </label>
            <span style={{ marginLeft: 16, color: '#888' }}>
              edit-mode bus (marquee): <b style={{ color: mode ? '#1a73e8' : '#aaa' }}>{mode?.key ?? 'idle'}</b>
              {mode && <button style={{ marginLeft: 8 }} onClick={() => editModeHandler.setMode(null)}>clear</button>}
            </span>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, maxWidth: 640, border: '1px solid #e5e5ea', borderRadius: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '3px 10px' }}>command</th>
                <th style={{ padding: '3px 10px' }}>state</th>
                <th style={{ padding: '3px 10px' }}>enablement</th>
                <th style={{ padding: '3px 10px' }}>disabledReasons</th>
              </tr>
            </thead>
            <tbody>{CLIPBOARD_KEYS.map((d) => <CommandStatus key={d.key} commandKey={d.key} />)}</tbody>
          </table>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>
            Click <b>Copy</b> / <b>Cut</b> → the fake clipboard fires <code>clipboardchange</code> and the
            contributor republishes the copied range onto the <b>edit-mode bus</b> (the marquee source).
            <b> Protect sheet</b> → cut / paste / pasteX disable while <b>Copy stays enabled</b> (they're
            not <code>mutator</code>-tagged, so this contributor owns their disable). <b>Format Painter</b> →
            publishes a <code>formatPainter</code> mode and lights its <i>state</i>; click again (or
            <b> clear</b>) to reset. This is <code>contributeClipboardCommands</code>; the real copy/paste
            I/O runs in-app.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const Clipboard = asStory(Template);
Clipboard.args = {};
Clipboard.storyName = 'Clipboard (copy/paste + format painter)';

const Story = { title: 'Commands' };
export default Story;
