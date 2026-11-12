import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';

import { AnchorLocation } from '@sheetxl/utils';

import { Command, KeyModifiers } from '@sheetxl/utils-react';

import {
  DefaultCellRenderer, Layer, VirtualDiv,
  type CellRendererProps, type IGridPane
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, asStory } from '../../components';

import { CommandButton, rowStyle } from './CommandButton';
import { CommandDispatchLayer } from './CommandDispatchLayer';

const {
  CommandScope, FocusActivation, CommandScopeContext, CommandAnchorProvider, useCommandScope
} = Command;

/**
 * Command resolution **through a grid** — the Approach-B de-risk gate (COMMAND-DESIGN.md
 * §"Layered resolver" / §"Grid integration plan"). It proves, with no custom layered resolver
 * (native `_parent`-walk only):
 *
 * - **Initial anchor** — before anything is focused the toolbar resolves `copy`/`fill` *enabled*:
 *   the tracker's one-shot initial anchor (a ctor `Promise` — a synthetic first focus) is resolved
 *   with the center pane scope when it mounts; real focus advances the anchor thereafter.
 * - **Placement rule** — `copy`/`fill` live on the **pane scope** (always-on, non-focusable). Focus
 *   on the Stage resolves to the pane, and the pane scope is what it lands on.
 * - **Override** — a focusable editor widget (a `VirtualDiv` in its own `Layer`) contributes a
 *   `copy` **override** as a child scope;
 *   focusing the editor input re-resolves `copy` to it (button label + the Ctrl/⌘+C shortcut).
 * - **Fall-through** — the editor does *not* contribute `fill`, so `fill` still resolves to the
 *   pane floor while the editor is focused (`editor → pane`, native walk).
 * - **Per-pane** (with freeze) — each pane is its own scope; focusing a different pane re-resolves
 *   against *its* scope, and a frozen pane disables `fill` via its own `disabledReasons` (a command
 *   reading **its own pane** for enablement).
 *
 * The grid itself stays command-agnostic — everything here is wired from the consumer side via the
 * `wrapPane` seam.
 */

// Story-local context so a feature LAYER (the editor) can reach the pane's tracker (to register its
// focusable element) + the run-log. In production a "feature-region provider" hook wraps this; it is
// inlined here so the focus→scope wiring is visible.
interface PaneCmd {
  focus: InstanceType<typeof FocusActivation>;
  onRun: (msg: string) => void;
}
const PaneCmdContext = createContext<PaneCmd | null>(null);

/**
 * The per-pane command scope (Approach B). Created + owned here (the provider disposes it on
 * unmount). The **placement rule**: always-on, non-focusable `copy`/`fill` are contributed on this
 * pane scope — the node Stage-focus resolves to. Registered with the tracker; the center pane seeds
 * the cold-start anchor. Rendered once per pane (up to 4 with freeze) ⇒ per-pane duplication.
 */
const PaneCommandProvider: React.FC<{
  pane: IGridPane;
  gridScope: InstanceType<typeof CommandScope>;
  focus: InstanceType<typeof FocusActivation>;
  /** Resolves the tracker's one-shot initial-anchor promise (the center pane calls it on mount). */
  seedCenter: (scope: InstanceType<typeof CommandScope>) => void;
  onRun: (msg: string) => void;
  children: React.ReactNode;
}> = ({ pane, gridScope, focus, seedCenter, onRun, children }) => {
  const anchor = pane.getAnchor();
  const isCenter = anchor === AnchorLocation.Center;
  const scope = useMemo(() => gridScope.createChild(`pane:${anchor}`), [gridScope, anchor]);

  // Placement rule: the always-on floor. `fill` reads THIS pane for a freeze-aware reason (a
  // command whose enablement depends on its own pane — the per-pane-scope payoff).
  useEffect(() => {
    scope.updateCommand('copy', {
      icon: '📋', label: 'Copy',
      shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] },
      callback: () => onRun(`copy → pane:${anchor}`)
    });
    scope.updateCommand('fill', {
      icon: '⬇', label: 'Fill Down',
      shortcut: { key: 'D', modifiers: [KeyModifiers.Ctrl] },
      disabledReasons: isCenter ? undefined : ['Fill is disabled in a frozen pane'],
      callback: () => onRun(`fill → pane:${anchor}`)
    });
  }, [scope, anchor, isCenter, onRun]);

  // Register the pane's Stage with the tracker; the CENTER pane resolves the tracker's one-shot
  // initial-anchor promise (the consumer's lifecycle moment — resolving twice is a promise no-op).
  // `getElement()` is the Stage and may be null for a frame until its ref attaches — retry on the
  // next frame.
  useEffect(() => {
    const removers: Array<() => void> = [];
    if (isCenter) seedCenter(scope); // one-shot initial anchor (cold-start), no element needed
    let cancelled = false;
    const register = (): void => {
      if (cancelled) return;
      const el = pane.getElement();
      if (!el) { requestAnimationFrame(register); return; }
      removers.push(focus.register(el, scope));
    };
    register();
    return () => { cancelled = true; removers.forEach((r) => r()); };
  }, [pane, scope, focus, isCenter, seedCenter]);

  const ctx = useMemo<PaneCmd>(() => ({ focus, onRun }), [focus, onRun]);
  return (
    <CommandScopeContext.Provider value={scope}>
      <PaneCmdContext.Provider value={ctx}>{children}</PaneCmdContext.Provider>
    </CommandScopeContext.Provider>
  );
};

/**
 * A focusable override layer — the editor. Its scope is a child of the pane scope (parented via
 * plain `useCommandScope()`, since the layer IS a React descendant — no z-walk). It contributes a
 * `copy` **override** and deliberately no `fill`, so `fill` falls through to the pane floor. It
 * registers its input with the tracker so focusing it advances the anchor here.
 */
const EditorCommandLayer: React.FC = () => {
  const paneScope = useCommandScope();
  const paneCmd = useContext(PaneCmdContext);
  const elRef = useRef<HTMLInputElement>(null);

  const editorScope = useMemo(() => paneScope?.createChild('editor') ?? null, [paneScope]);

  useEffect(() => {
    if (!editorScope || !paneCmd) return;
    editorScope.updateCommand('copy', {
      icon: '✏️', label: 'Copy (editor)',
      shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] },
      callback: () => paneCmd.onRun('copy → editor (OVERRIDE)')
    });
  }, [editorScope, paneCmd]);

  useEffect(() => {
    if (!editorScope || !paneCmd || !elRef.current) return;
    return paneCmd.focus.register(elRef.current, editorScope);
  }, [editorScope, paneCmd]);

  if (!editorScope) return null;
  // A composite grid child: one Layer at the root (law 4: the flat stack), hosting the editor's
  // VirtualDiv — a real div placed at a range, focusable like any div.
  return (
    <CommandScopeContext.Provider value={editorScope}>
      <Layer>
        <VirtualDiv
          range={{ colStart: 6, rowStart: 6, colEnd: 9, rowEnd: 7 }}
          style={{
            background: '#fff7d6', border: '2px solid #e0a800',
            display: 'flex', alignItems: 'center', padding: 4, boxSizing: 'border-box'
          }}
        >
          <input
            ref={elRef}
            placeholder="editor — focus me"
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', font: 'inherit' }}
          />
        </VirtualDiv>
      </Layer>
    </CommandScopeContext.Provider>
  );
};

const Template: React.FC<any> = (props) => {
  const {
    freezeTop = 0, freezeLeft = 0,
    rowCount = 100, columnCount = 26
  } = props;

  const surfaceRootRef = useRef<HTMLDivElement>(null);
  const [lastRun, setLastRun] = useState('—');
  const runRef = useRef(setLastRun);
  runRef.current = setLastRun;
  const onRun = useCallback((msg: string) => runRef.current(msg), []);

  // app → grid → (pane scopes are created per-pane by PaneCommandProvider). The tracker's one-shot
  // INITIAL anchor is a promise the center pane resolves on mount — the consumer settles it at its
  // own lifecycle moment (a synthetic first focus); real focus advances the anchor thereafter.
  const { grid, focus, seedCenter } = useMemo(() => {
    const app = new CommandScope('app');
    const grid = app.createChild('grid');
    let seedCenter!: (scope: InstanceType<typeof CommandScope>) => void;
    const initialAnchor = new Promise<InstanceType<typeof CommandScope> | null>((res) => { seedCenter = res; });
    return { grid, focus: new FocusActivation(null, initialAnchor), seedCenter };
  }, []);

  // Live readout of the focus anchor.
  const [anchorKey, setAnchorKey] = useState(() => focus.getAnchor()?.key ?? '(root)');
  useEffect(() => focus.subscribe(() => setAnchorKey(focus.getAnchor()?.key ?? '(root)')), [focus]);

  // Attach the tracker region to the surface root → the resolver auto-binds keystroke handling here,
  // so a key in any pane (its Stage is inside) bubbles to one dispatcher.
  useEffect(() => {
    if (!surfaceRootRef.current) return;
    return focus.attach(surfaceRootRef.current);
  }, [focus]);

  const wrapPane = useCallback((pane: IGridPane, children: React.ReactNode) => (
    <PaneCommandProvider pane={pane} gridScope={grid} focus={focus} seedCenter={seedCenter} onRun={onRun}>
      {children}
    </PaneCommandProvider>
  ), [grid, focus, seedCenter, onRun]);

  const renderCells = useCallback((p: CellRendererProps) => {
    const { key, ...rest } = p;
    return <DefaultCellRenderer key={key} {...rest} value={`${p.range!.rowStart}:${p.range!.colStart}`} />;
  }, []);

  return (
    <CommandScopeContext.Provider value={grid}>
      {/* keyBindings={false}: deliver keys via the grid's synthetic responder chain (CommandDispatchLayer),
          not a native listener — see the dispatch law. */}
      <CommandAnchorProvider tracker={focus} keyBindings={false}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
          <h3 style={{ margin: '0 0 8px' }}>Grid command resolution — pane floor + focusable editor override</h3>
          <div style={rowStyle}>
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="fill" />
            <span style={{ color: '#888' }}>anchor: <b>{anchorKey}</b></span>
            <span style={{ color: '#888' }}>last run: <b>{lastRun}</b></span>
          </div>
          <div ref={surfaceRootRef} style={{ flex: 1, minHeight: 360, position: 'relative', border: '1px solid #ddd' }}>
            <Grid
              rowCount={rowCount}
              columnCount={columnCount}
              getRowHeight={24}
              getColumnWidth={80}
              freezeTop={freezeTop}
              freezeLeft={freezeLeft}
              renderCells={renderCells}
              wrapPane={wrapPane}
            >
              <EditorCommandLayer />
              <CommandDispatchLayer />
            </Grid>
          </div>
          <p style={{ color: '#888', maxWidth: 760 }}>
            The toolbar resolves <b>before any focus</b> (the center pane <i>seeds</i> the anchor).
            Click a cell → anchor is the <b>pane</b> (its floor owns <i>Copy</i>/<i>Fill</i>). Click
            into the yellow <b>editor</b> → <i>Copy</i> re-resolves to the editor's <b>override</b>
            (and Ctrl/⌘+C runs it), while <i>Fill</i> still <b>falls through</b> to the pane. Set
            <code> freezeTop</code>/<code>freezeLeft</code> to split into panes: each pane is its own
            scope, and the frozen panes disable <i>Fill</i> via their own reason.
          </p>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const GridResolution = asStory(Template);
GridResolution.args = { freezeTop: 0, freezeLeft: 0, rowCount: 100, columnCount: 26 };
GridResolution.storyName = 'Grid Resolution';

export const GridResolutionFrozen = asStory(Template);
GridResolutionFrozen.args = { freezeTop: 5, freezeLeft: 4, rowCount: 100, columnCount: 26 };
GridResolutionFrozen.storyName = 'Grid Resolution (frozen panes)';

const Story = { title: 'Commands' };
export default Story;
