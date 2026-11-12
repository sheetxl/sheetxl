import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Command, KeyModifiers } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const {
  CommandScope, FocusActivation, ManualActivation,
  CommandScopeContext, CommandAnchorProvider, useCommands
} = Command;

type Scope = InstanceType<typeof CommandScope>;
type Focus = InstanceType<typeof FocusActivation>;

/**
 * **Two toolbars, two resolvers, ONE registry** — the resolution matrix the contributor port rides
 * on (COMMAND-DESIGN.md open-Q4, sharpened). It de-risks the thing the selection stories never did:
 * a single key (`copy`) contended by two features, plus a command that is "always on" *not* because
 * it sits on a common ancestor, but because its toolbar **resolves against a pinned scope** and
 * ignores focus entirely.
 *
 * The registry is one scope tree:
 * ```
 *   root            catalog chrome: copy (no callback ⇒ disabled), bold, run
 *    ├─ grid        callbacks: copy → CELLS, bold (a STATE toggle)
 *    └─ script      callbacks: copy → TEXT,  run
 * ```
 * Two `CommandAnchorProvider`s wrap that one tree with **different anchor sources**:
 * - **Main toolbar** — `tracker={focus}` (a `FocusActivation`): resolves from whichever panel is
 *   focused. So `copy` follows focus (CELLS │ TEXT) and `bold` is enabled only with the grid focused
 *   — focus the script panel and `bold` goes **off-chain → disabled** (its callback lives on `grid`,
 *   which is not in the `script → root` chain).
 * - **Scripting subbar** — `tracker={new ManualActivation(script)}` (pinned to `script`, no DOM
 *   element ⇒ no keybinds, never re-evaluates on focus): `run` is **always** enabled and `copy` is
 *   **always** TEXT, regardless of where focus is.
 *
 * **The money shot:** focus the **grid** panel → the main toolbar's *Copy* reads **CELLS** while the
 * subbar's *Copy* reads **TEXT** at the same instant — same key, two resolvers, two anchors, two live
 * values. That single frame is the whole proof.
 */

// A focusable panel: registering its element with the tracker makes its scope the anchor on focus.
// Pure view — the command contributions live in the template (they need the toggle state + log).
const FocusPanel: React.FC<{
  title: string; hint: string; accent: string; active: boolean;
  scope: Scope; focus: Focus;
}> = ({ title, hint, accent, active, scope, focus }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return focus.register(ref.current, scope);
  }, [focus, scope]);
  return (
    <div
      ref={ref}
      tabIndex={0}
      style={{
        flex: 1, minHeight: 120, borderRadius: 6, padding: 12, cursor: 'pointer', outline: 'none',
        border: `2px solid ${active ? accent : '#ccc'}`,
        background: active ? `${accent}14` : '#fafafa',
        boxShadow: active ? `0 0 0 3px ${accent}33` : 'none'
      }}
    >
      <b style={{ color: active ? accent : '#444' }}>{title}{active ? ' — anchor' : ''}</b>
      <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{hint}</div>
    </div>
  );
};

// Reads `bold`'s resolved STATE through the nearest resolver (proving STATE = output flows through
// resolution, not the raw template value). Lives inside the main toolbar's provider.
const BoldStateBadge: React.FC = () => {
  const [bold] = useCommands<boolean>('bold');
  const on = bold?.getState() ?? false;
  return <span style={{ color: '#888' }}>bold state: <b>{on ? 'ON' : 'OFF'}</b></span>;
};

const Template: React.FC<any> = () => {
  const rootElRef = useRef<HTMLDivElement>(null);

  const { root, grid, script, focus, manualScript } = useMemo(() => {
    const root = new CommandScope('root');
    const grid = root.createChild('grid');
    const script = root.createChild('script');
    // Catalog (app-load): static chrome at the ROOT — buttons render even when the behavior is
    // off-chain. copy has NO callback here ⇒ disabled at root (the "chrome at load" state).
    root.updateCommand('copy', { label: 'Copy', icon: '📋', shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] } });
    root.updateCommand('bold', { label: 'Bold', icon: '𝐁', shortcut: { key: 'B', modifiers: [KeyModifiers.Ctrl] } });
    root.updateCommand('run', { label: 'Run', icon: '▶', shortcut: { key: 'Enter', modifiers: [KeyModifiers.Ctrl] } });
    return {
      root, grid, script,
      focus: new FocusActivation(null, grid), // initial anchor = grid (cold-start)
      manualScript: new ManualActivation(script) // pinned: the subbar resolves from `script`, always
    };
  }, []);

  const [bold, setBold] = useState(false);
  const [last, setLast] = useState('—');

  // grid feature (mounts once, persistent): copy → CELLS, and bold as a STATE toggle. Re-contributing
  // on `bold` change re-resolves the toggle (the `updateCommand` + invalidate pattern of Q4 step 2).
  useEffect(() => {
    grid.updateCommand<boolean>('copy', { callback: () => setLast('copy → CELLS (grid)') });
  }, [grid]);
  useEffect(() => {
    grid.updateCommand<boolean>('bold', {
      state: bold,
      callback: () => { setBold((v) => !v); setLast(`bold → ${bold ? 'OFF' : 'ON'} (grid)`); }
    });
  }, [grid, bold]);

  // scripting feature (mounts once, persistent): copy → TEXT, and run.
  useEffect(() => {
    script.updateCommand('copy', { callback: () => setLast('copy → TEXT (script)') });
    script.updateCommand('run', { callback: () => setLast('run → SCRIPT (script)') });
  }, [script]);

  // Anchor readout. (The cold-start anchor is the tracker's ctor `initialAnchor` — `grid`, above.)
  const [anchorKey, setAnchorKey] = useState('grid');
  useEffect(() => {
    return focus.subscribe(() => setAnchorKey(focus.getAnchor()?.key ?? '(root)'));
  }, [focus]);

  useEffect(() => {
    if (!rootElRef.current) return;
    return focus.attach(rootElRef.current);
  }, [focus]);

  return (
    <CommandScopeContext.Provider value={root}>
      <div ref={rootElRef} style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0 }}>Two toolbars · two resolvers · one registry</h3>

        {/* MAIN TOOLBAR — resolver A: anchored to focus (grid │ script). */}
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Main toolbar — <code>tracker=focus</code></div>
          <CommandAnchorProvider tracker={focus}>
            <div style={rowStyle}>
              <CommandButton commandKey="copy" />
              <CommandButton commandKey="bold" />
              <BoldStateBadge />
            </div>
          </CommandAnchorProvider>

          {/* SCRIPTING SUBBAR — resolver B: pinned to `script`, ignores focus. Nested visually under
              the main toolbar (the real app's layout), but its own resolver/anchor. */}
          <div style={{ marginLeft: 16, borderLeft: '3px solid #7048e8', paddingLeft: 12 }}>
            <div style={{ fontSize: 12, color: '#7048e8', marginTop: 4 }}>Scripting subbar — <code>tracker=manual(script)</code></div>
            <CommandAnchorProvider tracker={manualScript}>
              <div style={rowStyle}>
                <CommandButton commandKey="run" />
                <CommandButton commandKey="copy" />
              </div>
            </CommandAnchorProvider>
          </div>
        </div>

        {/* The two focusable areas that drive the focus tracker. */}
        <div style={{ display: 'flex', gap: 12 }}>
          <FocusPanel title="Grid area" hint="Click to focus. Contributes copy → CELLS and bold." accent="#1971c2" active={anchorKey === 'grid'} scope={grid} focus={focus} />
          <FocusPanel title="Script editor" hint="Click to focus. Contributes copy → TEXT and run." accent="#7048e8" active={anchorKey === 'script'} scope={script} focus={focus} />
        </div>

        <div style={{ display: 'flex', gap: 24, color: '#888' }}>
          <span>anchor: <b>{anchorKey}</b></span>
          <span>last action: <b style={{ color: '#222' }}>{last}</b></span>
        </div>

        <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5 }}>
          <b>Focus the grid</b> → main <i>Copy</i> = <b>CELLS</b>, subbar <i>Copy</i> = <b>TEXT</b> (same
          key, two anchors). <b>Bold</b> enabled, toggles its state. <b>Focus the script editor</b> →
          main <i>Copy</i> flips to <b>TEXT</b> and <i>Bold</i> goes <b>disabled</b> (off-chain). The
          subbar never changes — <i>Run</i> stays enabled and <i>Copy</i> stays TEXT no matter what is
          focused (pinned resolver). <code>Mod+C</code> / <code>Mod+B</code> work while a panel is focused.
        </div>
      </div>
    </CommandScopeContext.Provider>
  );
};

export const TwoToolbars = asStory(Template);
TwoToolbars.args = {};
TwoToolbars.storyName = 'Two Toolbars (pinned vs focus)';

const Story = { title: 'Commands' };
export default Story;
