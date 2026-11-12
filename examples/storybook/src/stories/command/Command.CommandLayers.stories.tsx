import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { Command, KeyModifiers } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const {
  CommandScope, CommandScopeContext, CommandAnchorProvider, useCommands, LayerActivation, FocusActivation
} = Command;

type Scope = InstanceType<typeof CommandScope>;
type Contribution = Command.CommandContribution;

/**
 * **THE layer proof** — command resolution that walks the **z-ordered layer stack**, so a client can
 * add behavior *entirely from the outside* (no core special-casing), and a **stacked** layer overrides
 * a command by **stacking**, not by focus.
 *
 * The mechanism is the {@link LayerActivation} — the "z-ordered layer→scope
 * registry." It uses **only** the existing core: each layer gets a `CommandScope`, and the registry
 * `setParent`s them into a chain ordered by z (higher z → deeper → wins), reporting the **top** as the
 * anchor. The unchanged `CommandScope.resolve` (which walks `_parent` from the anchor) then resolves
 * **top-of-stack first**. Keys and buttons both go through that one `resolve`, so they're identical.
 *
 * The star is a **fully external `formatPainter`**: nothing in this base knows it exists. A single
 * self-contained component (mounted by the checkbox) does all three of the client-authoring steps —
 * (1) register the command **definition** (chrome), (2) contribute the command **behavior** via a
 * layer scope, (3) draw its **layer**. Toggle it and the toolbar button, keystroke, and marquee all
 * light up; untoggle and they vanish — with zero edits to the "grid" below.
 */

// ── A generic external "command layer": scope + commands + a drawn strip, self-registering ─────────
// This is the whole client contract — nothing here is sheetxl-specific.
const CommandLayer: React.FC<{
  root: Scope;
  tracker: Command.LayerActivation;
  scopeKey: string;
  z: number;
  color: string;
  label: string;
  registerChrome?: (root: Scope) => void;      // (1) the command DEFINITION (chrome)
  contribute: (contribution: Contribution) => void; // (2) the command BEHAVIOR
}> = ({ root, tracker, scopeKey, z, color, label, registerChrome, contribute }) => {
  useEffect(() => {
    registerChrome?.(root);
    const scope = root.createChild(scopeKey);       // its own scope (same root)
    const contribution = scope.contribution();
    contribute(contribution);
    const unregister = tracker.register(scope, z);  // splice into the z-stack
    return () => { unregister(); contribution.remove(); scope.dispose(); };
    // // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (3) the DRAWING — the same layer that injects commands also renders. A real one would be a
  // grid Layer (marquee/handles); here it's a labeled strip so you can see it stack.
  return (
    <div style={{ background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '4px 10px', fontSize: 13 }}>
      {label} <span style={{ color: '#888' }}>· z={z}</span>
    </div>
  );
};

// Reads a command through the resolver and shows what won.
const CommandStatus: React.FC<{ commandKey: string }> = ({ commandKey }) => {
  const [cmd] = useCommands(commandKey);
  const disabled = cmd?.disabled() ?? true;
  return (
    <tr style={{ borderTop: '1px solid #eee' }}>
      <td style={{ padding: '3px 10px', fontFamily: 'monospace' }}>{commandKey}</td>
      <td style={{ padding: '3px 10px' }}><b>{cmd?.getLabel() ?? <span style={{ color: '#bbb' }}>— not in the stack —</span>}</b></td>
      <td style={{ padding: '3px 10px', fontWeight: 600, color: disabled ? '#e03131' : '#2f9e44' }}>{cmd ? (disabled ? 'disabled' : 'enabled') : '—'}</td>
    </tr>
  );
};

// Logs every execution of these keys — fires for BOTH button clicks and keystrokes (same path),
// so an identical log line proves keys ≡ commands.
const ExecuteLogger: React.FC<{ push: (m: string) => void }> = ({ push }) => {
  useCommands(['copy', 'paste', 'formatPainterToggle'], {
    onExecute: (cmd: any) => push(`▶ executed: ${cmd?.getLabel?.() ?? '?'}`)
  });
  return null;
};

const KEYS = ['copy', 'paste', 'formatPainterToggle'];

const Template: React.FC<any> = () => {
  const [log, push] = useReducer((s: string[], m: string) => [m, ...s].slice(0, 6), []);
  const [showFormatPainter, setShowFormatPainter] = useState(false);
  const [showEditorCopy, setShowEditorCopy] = useState(false);

  const { root, layers, region } = useMemo(() => {
    const root = new CommandScope('app');
    // Base catalog: copy/paste chrome. NOTE: formatPainterToggle is deliberately ABSENT — the external
    // layer registers its own definition, proving the base knows nothing about it.
    root.updateCommand('copy', { label: 'Copy', icon: '⧉', shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] } });
    root.updateCommand('paste', { label: 'Paste', icon: '📋', shortcut: { key: 'V', modifiers: [KeyModifiers.Ctrl] } });
    const base = root.createChild('grid');
    base.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    base.updateCommand('paste', { label: 'Paste Cells', callback: () => {} });
    // One region (this stage) + its layer stack, focus-selected so the resolver binds keys on the root.
    const layers = new LayerActivation(base);
    const region = new FocusActivation(null, layers); // initial anchor = the layer stack-top (cold-start)
    return { root, layers, region };
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rootRef.current) return undefined;
    const detach = region.attach(rootRef.current);
    const unregister = region.register(rootRef.current, layers);
    return () => { detach(); unregister(); };
  }, [region, layers]);

  return (
    <CommandScopeContext.Provider value={root}>
      {/* keyBindings on (default): the resolver binds keydown to the region root, so a real Ctrl+C
          resolves through the SAME resolve() the button uses. */}
      <CommandAnchorProvider tracker={region} debounce={0}>
        <ExecuteLogger push={push} />
        <div ref={rootRef} tabIndex={0} style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, outline: 'none' }}>
          <h3 style={{ margin: 0 }}>Command layers — resolve down the z-stack (override by stacking, not focus)</h3>

          {/* Toolbar — generic buttons; the formatPainter button is inert until its external layer mounts. */}
          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
            {KEYS.map((k) => <CommandButton key={k} commandKey={k} />)}
          </div>

          {/* The "stage": the base grid + whatever external layers are stacked on it (bottom → top). */}
          <div style={{ border: '1px dashed #bbb', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column-reverse', gap: 6, background: '#fafafa' }}>
            <div style={{ background: '#e9ecef', borderRadius: 4, padding: '4px 10px', fontSize: 13 }}>grid (base) <span style={{ color: '#888' }}>· copy = "Copy Cells"</span></div>
            {showFormatPainter && (
              <CommandLayer
                root={root} tracker={layers} scopeKey="ext-format-painter" z={50}
                color="#ffe8cc" label="🖌 FormatPainter layer (external)"
                registerChrome={(r) => r.updateCommand('formatPainterToggle', {
                  label: 'Format Painter', icon: '🖌',
                  shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift] }
                })}
                contribute={(c) => c.updateCommand('formatPainterToggle', { callback: () => {}, state: false })}
              />
            )}
            {showEditorCopy && (
              <CommandLayer
                root={root} tracker={layers} scopeKey="ext-editor" z={100}
                color="#d0ebff" label="✎ Editor layer (external) — overrides Copy"
                contribute={(c) => c.updateCommand('copy', { label: 'Copy Text', callback: () => {} })}
              />
            )}
          </div>

          <div style={rowStyle}>
            <label style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={showFormatPainter} onChange={(e) => setShowFormatPainter(e.target.checked)} />
              {' '}Add <b>FormatPainter</b> layer <span style={{ color: '#888' }}>(external: def + behavior + draw)</span>
            </label>
            <label style={{ marginLeft: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={showEditorCopy} onChange={(e) => setShowEditorCopy(e.target.checked)} />
              {' '}Stack <b>Editor</b> layer (z=100) <span style={{ color: '#888' }}>(overrides <code>copy</code>)</span>
            </label>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, maxWidth: 560, border: '1px solid #e5e5ea', borderRadius: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '3px 10px' }}>command</th>
                <th style={{ padding: '3px 10px' }}>resolves to (winning label)</th>
                <th style={{ padding: '3px 10px' }}>enablement</th>
              </tr>
            </thead>
            <tbody>{KEYS.map((k) => <CommandStatus key={k} commandKey={k} />)}</tbody>
          </table>

          <div style={{ display: 'flex', gap: 24, color: '#888', fontSize: 14 }}>
            <span>exec log: <b style={{ color: '#222' }}>{log[0] ?? '—'}</b></span>
          </div>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.55, maxWidth: 620 }}>
            <b>Click into this box, press Ctrl+C</b> — the log shows the SAME line as clicking the <b>Copy</b>
            button (keys ≡ commands: one <code>resolve</code>). <b>Stack the Editor layer</b> → <code>copy</code>
            resolves to <b>"Copy Text"</b> purely by <i>stacking</i> — no focus moved. Untoggle → it reverts to
            <b> "Copy Cells"</b>. <b>Add FormatPainter</b> → its <i>definition</i>, <i>behavior</i>, and
            <i> drawing</i> all appear from one external component; the base grid was never touched. That is the
            whole vision: a client builds <code>formatPainter</code> with zero core special-casing.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const CommandLayers = asStory(Template);
CommandLayers.args = {};
CommandLayers.storyName = 'Command Layers (z-stack resolution)';

const Story = { title: 'Commands' };
export default Story;
