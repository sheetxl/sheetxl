import React, { useMemo, useRef, useState } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider } = Command;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Dispatch middleware via **`scope.use(tx)`** — registered **once** on the scope, it
 * auto-wraps every callback that scope authors (the new-model stand-in for
 * `doTransactionalCommand`: begin/commit/rollback + a busy indicator). The contributor's inner
 * callbacks stay **pure**; the cross-cutting infra is the one registered wrapper.
 *
 * Key point — middleware is **bound to the scope that authored the callback; it is NOT
 * inherited.** `selection` is nested *under* `sheet`, but it's its own provider with no
 * `use(tx)`, contributing **raw** callbacks, so it's non-transactional even though `sheet` is.
 * Which commands are transactional = which provider authored them.
 */
const Template: React.FC = () => {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Stable handle the (once-created) middleware closes over.
  const apiRef = useRef<{ log: (s: string) => void; setBusy: (s: string | null) => void }>(null!);
  apiRef.current = { log: (s) => setLog((l) => [...l, s]), setBusy };

  const { app, sheet, selection, tx } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const selection = sheet.createChild('selection'); // nested UNDER sheet on purpose

    // Onion middleware: receives `next`, returns a wrapper. `command` (2nd arg) gives the label.
    const tx = (next: (a: any, c?: any) => any) => async (args: any, command?: any): Promise<void> => {
      const label = command?.getLabel?.() ?? 'command';
      apiRef.current.setBusy(label);
      apiRef.current.log(`▶ begin "${label}"`);
      try {
        await next(args, command);
        apiRef.current.log(`✓ commit "${label}"`);
      } catch (e) {
        apiRef.current.log(`✗ rolled back "${label}" — ${(e as Error).message}`);
      } finally {
        apiRef.current.setBusy(null);
      }
    };

    // `tx` is registered on the SHEET scope via `use={tx}` on its CommandScopeContext below
    // (a provider doesn't need the scope handle). So sheet's callbacks stay PURE here:
    sheet.updateCommand('bold', { label: 'Bold', icon: '𝐁', callback: async () => { await sleep(450); } });
    sheet.updateCommand('risky', {
      label: 'Risky Op', icon: '⚠', callback: async () => { await sleep(300); throw new Error('SDK rejected'); }
    });
    // selection authored its own callback and did NOT use(tx) — raw, even though it's under sheet.
    selection.updateCommand('clearSel', {
      label: 'Clear Selection', icon: '⌫',
      callback: async () => { await sleep(200); apiRef.current.log('• selection cleared (raw — no tx)'); }
    });

    // Register the middleware on the SHEET scope — a raw context provider can't, so we do it here, on the
    // scope that AUTHORS bold/risky. selection (also under sheet) doesn't `use(tx)`, so it stays raw.
    sheet.use(tx);
    return { app, sheet, selection, tx };
  }, []);

  // Anchor at the leaf (selection) so all three resolve up the chain.
  const tracker = useMemo(() => new ManualActivation(selection), [selection]);

  return (
    <CommandScopeContext.Provider value={app}>
      {/* `tx` was registered on the SHEET scope (`sheet.use(tx)` above) — middleware binds to the scope
          that AUTHORS the callbacks (sheet's bold/risky), not to an ancestor. selection (also under sheet)
          has no `use`, so it's raw. */}
      <CommandScopeContext.Provider value={sheet}>
        <CommandAnchorProvider tracker={tracker}>
          <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
          <h3>Dispatch Middleware — scope.use(tx), bound to the authoring provider</h3>
          <div style={rowStyle}>
            <CommandButton commandKey="bold" />
            <CommandButton commandKey="risky" />
            <CommandButton commandKey="clearSel" />
            <span style={{ width: 130, color: busy ? '#b8860b' : '#bbb' }}>
              {busy ? `⏳ ${busy}…` : 'idle'}
            </span>
          </div>

          <div style={{
            marginTop: 8, padding: 10, borderRadius: 4, background: '#0b1021', color: '#cde',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, minHeight: 120, whiteSpace: 'pre-wrap'
          }}>
            {log.length === 0 ? <span style={{ color: '#567' }}>— transaction log —</span>
              : log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <button onClick={() => setLog([])} style={{ marginTop: 8, padding: '4px 8px' }}>Clear log</button>

          <p style={{ color: '#888', maxWidth: 620 }}>
            <b>Bold</b>/<b>Risky Op</b> are authored by the <b>sheet</b> scope, whose provider got
            <code>use={'{tx}'}</code> → both are auto-wrapped: you see <i>begin/commit</i> (or
            <i>rolled back</i> on the throw) and a busy flash, yet their callbacks are
            <b>pure</b>. <b>Clear Selection</b> is authored by the <b>selection</b> scope —
            nested <i>under</i> sheet, but with no <code>use</code>, so its callback runs
            <b>raw</b>. Middleware binds to the authoring scope; it is not inherited.
          </p>
          </div>
        </CommandAnchorProvider>
      </CommandScopeContext.Provider>
    </CommandScopeContext.Provider>
  );
};

export const Middleware = asStory(Template);
Middleware.storyName = 'Middleware (contributor-side)';

const Story = { title: 'Commands' };
export default Story;
