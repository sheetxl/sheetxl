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
 * **Phase 2 proof — focus × z compose.** Resolution needs two selectors and this story proves they
 * nest cleanly:
 *
 * - **z (within a region)** — which *layer* wins, via {@link LayerActivation} (the z-stack top).
 * - **focus (across regions)** — which *region* is active (grid vs script editor), via
 *   {@link RegionActivation}: it maps DOM focus → a region's tracker and **delegates `getAnchor` to the
 *   active region's stack-top**. A plain static region is just `ConstantActivation(scope)`.
 *
 * So **focus picks the stack; z picks the layer in it** — one toolbar, one `resolve`, keys ≡ buttons.
 * Two regions below (a mock grid, a mock script editor) each carry their own layer stack. Click into a
 * region to activate it (the toolbar follows); toggle a layer to override a command *within* that
 * region by stacking. `run` exists only in the script region — proving focus really does pick the
 * region, not just relabel.
 */

// `LayerActivation` (z-stack) + `RegionActivation` (focus→region) are now command core
// primitives — imported above, not redefined here.

// A command layer within a given region (its stack). Renders a strip (draw) + injects a command.
const CommandLayer: React.FC<{
  root: Scope; region: Command.LayerActivation; scopeKey: string; z: number; color: string; label: string;
  contribute: (c: Contribution) => void;
}> = ({ root, region, scopeKey, z, color, label, contribute }) => {
  useEffect(() => {
    const scope = root.createChild(scopeKey);
    const contribution = scope.contribution();
    contribute(contribution);
    const unregister = region.register(scope, z);
    return () => { unregister(); contribution.remove(); scope.dispose(); };
  }, []);
  return <div style={{ background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '3px 8px', fontSize: 12 }}>{label} · z={z}</div>;
};

const CommandStatus: React.FC<{ commandKey: string }> = ({ commandKey }) => {
  const [cmd] = useCommands(commandKey);
  const disabled = cmd?.disabled() ?? true;
  return (
    <tr style={{ borderTop: '1px solid #eee' }}>
      <td style={{ padding: '3px 10px', fontFamily: 'monospace' }}>{commandKey}</td>
      <td style={{ padding: '3px 10px' }}><b>{cmd?.getLabel() ?? <span style={{ color: '#bbb' }}>— not here —</span>}</b></td>
      <td style={{ padding: '3px 10px', fontWeight: 600, color: disabled ? '#e03131' : '#2f9e44' }}>{cmd ? (disabled ? 'disabled' : 'enabled') : '—'}</td>
    </tr>
  );
};

const ExecuteLogger: React.FC<{ push: (m: string) => void }> = ({ push }) => {
  useCommands(['copy', 'run'], { onExecute: (cmd: any) => push(`▶ ${cmd?.getLabel?.() ?? '?'}`) });
  return null;
};

const KEYS = ['copy', 'run'];
const regionBox = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? '#1a73e8' : '#ccc'}`, borderRadius: 8, padding: 12, flex: 1,
  display: 'flex', flexDirection: 'column', gap: 8, outline: 'none', background: active ? '#f2f7ff' : '#fafafa'
});

const Template: React.FC<any> = () => {
  const [log, push] = useReducer((s: string[], m: string) => [m, ...s].slice(0, 6), []);
  const [editorInGrid, setEditorInGrid] = useState(false);
  const [debugInScript, setDebugInScript] = useState(false);
  const [, force] = useReducer((n) => n + 1, 0);

  const { root, gridRegion, scriptRegion, region } = useMemo(() => {
    const root = new CommandScope('app');
    // Shared catalog chrome (both regions' copy share the icon/shortcut; run is script-only chrome).
    root.updateCommand('copy', { label: 'Copy', icon: '⧉', shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] } });
    root.updateCommand('run', { label: 'Run', icon: '▶', shortcut: { key: 'Enter', modifiers: [KeyModifiers.Ctrl] } });

    const gridBase = root.createChild('grid');
    gridBase.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    const scriptBase = root.createChild('script');
    scriptBase.updateCommand('copy', { label: 'Copy Script', callback: () => {} });
    scriptBase.updateCommand('run', { label: 'Run Script', callback: () => {} });

    const gridRegion = new LayerActivation(gridBase);
    const scriptRegion = new LayerActivation(scriptBase);
    const region = new FocusActivation(null, gridRegion); // initial anchor = grid stack-top (cold-start)
    return { root, gridRegion, scriptRegion, region };
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rootRef.current || !gridRef.current || !scriptRef.current) return undefined;
    const detach = region.attach(rootRef.current);
    const rg = region.register(gridRef.current, gridRegion);
    const rs = region.register(scriptRef.current, scriptRegion);
    const sub = region.subscribe(force); // re-render the region highlight on focus change
    return () => { detach(); rg(); rs(); sub(); };
  }, [region, gridRegion, scriptRegion]);

  // (display-only) which region is active, for the highlight — derive from the anchor scope's key
  // (the base 'grid'/'script', or the stacked top layer 'g-*'/'s-*').
  const anchorKey = region.getAnchor()?.key ?? '';
  const gridActive = anchorKey === 'grid' || anchorKey.startsWith('g-');
  const scriptActive = anchorKey === 'script' || anchorKey.startsWith('s-');

  return (
    <CommandScopeContext.Provider value={root}>
      <CommandAnchorProvider tracker={region} debounce={0}>
        <ExecuteLogger push={push} />
        <div ref={rootRef} style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Focus × z — focus picks the region, z picks the layer</h3>

          {/* One toolbar, outside both regions. It resolves against whichever region is focused. */}
          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
            <span style={{ color: '#888', marginRight: 8 }}>toolbar →</span>
            {KEYS.map((k) => <CommandButton key={k} commandKey={k} />)}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {/* Region A: grid */}
            <div ref={gridRef} tabIndex={0} style={regionBox(gridActive)}>
              <b>🗂 grid region {gridActive && '· ACTIVE'}</b>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
                <div style={{ background: '#e9ecef', borderRadius: 4, padding: '3px 8px', fontSize: 12 }}>base · copy = "Copy Cells"</div>
                {editorInGrid && (
                  <CommandLayer root={root} region={gridRegion} scopeKey="g-editor" z={100} color="#d0ebff"
                    label="✎ editor — overrides Copy" contribute={(c) => c.updateCommand('copy', { label: 'Copy Text', callback: () => {} })} />
                )}
              </div>
              <label style={{ fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={editorInGrid} onChange={(e) => setEditorInGrid(e.target.checked)} /> stack editor layer
              </label>
            </div>

            {/* Region B: script */}
            <div ref={scriptRef} tabIndex={0} style={regionBox(scriptActive)}>
              <b>{'{}'} script region {scriptActive && '· ACTIVE'}</b>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
                <div style={{ background: '#e9ecef', borderRadius: 4, padding: '3px 8px', fontSize: 12 }}>base · copy = "Copy Script" · run = "Run Script"</div>
                {debugInScript && (
                  <CommandLayer root={root} region={scriptRegion} scopeKey="s-debug" z={100} color="#ffe3e3"
                    label="🐞 debug — overrides Run" contribute={(c) => c.updateCommand('run', { label: 'Run Debug', callback: () => {} })} />
                )}
              </div>
              <label style={{ fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={debugInScript} onChange={(e) => setDebugInScript(e.target.checked)} /> stack debug layer
              </label>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, maxWidth: 520, border: '1px solid #e5e5ea', borderRadius: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '3px 10px' }}>command</th>
                <th style={{ padding: '3px 10px' }}>toolbar resolves to</th>
                <th style={{ padding: '3px 10px' }}>enablement</th>
              </tr>
            </thead>
            <tbody>{KEYS.map((k) => <CommandStatus key={k} commandKey={k} />)}</tbody>
          </table>

          <div style={{ color: '#888', fontSize: 14 }}>exec log: <b style={{ color: '#222' }}>{log[0] ?? '—'}</b></div>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.55, maxWidth: 620 }}>
            <b>Click into the grid</b> → toolbar <code>copy</code> = "Copy Cells", <code>run</code> disabled. Press
            Ctrl+C → same as clicking Copy (keys ≡ buttons). <b>Stack the editor layer</b> → <code>copy</code> =
            "Copy Text" by stacking (z, no focus change). Now <b>click into the script region</b> → <code>copy</code>
            = "Copy Script" and <code>run</code> enables (<i>focus</i> picked the region). <b>Stack debug</b> →
            <code>run</code> = "Run Debug" (z within the script region). Focus picks the stack; z picks the layer.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const RegionLayers = asStory(Template);
RegionLayers.args = {};
RegionLayers.storyName = 'Region Layers (focus × z)';

const Story = { title: 'Commands' };
export default Story;
