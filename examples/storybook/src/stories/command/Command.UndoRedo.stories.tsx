import React, { useEffect, useMemo, useRef, useState } from 'react';

import { UndoManager } from '@sheetxl/utils';

import { Command } from '@sheetxl/utils-react';

import { contributeUndoCommands } from '@sheetxl/react';

import { asStory } from '../../components';

// Undo/redo chrome now lives in the command catalog (`sheet.cmd.en.json`, fetched at runtime). This
// story seeds a minimal synchronous chrome inline (a demo scope, no fetch) so it stays self-contained.
const seedUndoChrome = (target: { updateCommand: (key: string, partial: any) => void }): void => {
  target.updateCommand('undo', { label: 'Undo', shortcut: { key: 'z', modifiers: ['ctrl'] } });
  target.updateCommand('redo', { label: 'Redo', shortcut: { key: 'y', modifiers: ['ctrl'] } });
};

import { CommandButton, rowStyle } from './CommandButton';

const {
  CommandScope, FocusActivation, CommandScopeContext, CommandAnchorProvider
} = Command;

type Scope = InstanceType<typeof CommandScope>;
type Focus = InstanceType<typeof FocusActivation>;

/**
 * **Recipe-setter for the contributor port: dynamic `disabledReason` + dynamic `description`, driven
 * by a model listener** — the half of the pattern the selection port never exercised (selection
 * commands are stateless + always-enabled) and the half that dominates `useSheetCommands`'s ~600-line
 * disable-block. Proves it on `useUndoManager`, in miniature.
 *
 * It also proves **always-on by ANCESTOR placement**: undo's behavior is contributed onto a dedicated
 * `Undo` scope that sits ABOVE the workbook —
 * ```
 *   studio(root)
 *    └─ undo            ← undo/redo CALLBACK + dynamic disabled/description (mount-lifetime)
 *        └─ workbook
 *            ├─ sheet
 *            │   └─ selection
 *            │       └─ editor   (deeper child = higher z)
 *            └─ scripting
 * ```
 * so EVERY descendant anchor (sheet, the deep editor, the scripting branch) resolves undo by walking
 * up to it. This is the *other* always-on mechanism from `Command.TwoToolbars` (a pinned resolver) —
 * the right one here because undo's consumers are all descendants. The contribution takes the scope
 * **explicitly** (`useContributeUndoCommands(undoScope, manager)`), so placement is a one-line wiring
 * choice, not baked into the contributor.
 */

// `registerUndoCommandsStatic` (catalog chrome) + `contributeUndoCommands` (a plain function — behavior
// onto an explicit scope, re-contributed on stack change, returns a disposer) are the REAL
// `@sheetxl/react` module — this story is their integration test.

// A focusable panel that makes its scope the anchor on focus (the tree's leaves).
const FocusPanel: React.FC<{
  title: string; hint: string; accent: string; active: boolean; scope: Scope; focus: Focus;
  children?: React.ReactNode;
}> = ({ title, hint, accent, active, scope, focus, children }) => {
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
        flex: 1, minHeight: 96, borderRadius: 6, padding: 12, cursor: 'pointer', outline: 'none',
        border: `2px solid ${active ? accent : '#ccc'}`,
        background: active ? `${accent}14` : '#fafafa',
        boxShadow: active ? `0 0 0 3px ${accent}33` : 'none'
      }}
    >
      <b style={{ color: active ? accent : '#444' }}>{title}{active ? ' — anchor' : ''}</b>
      <div style={{ color: '#888', fontSize: 13, margin: '6px 0' }}>{hint}</div>
      {children}
    </div>
  );
};

const Template: React.FC<any> = () => {
  const rootElRef = useRef<HTMLDivElement>(null);

  const { studio, sheet, editor, scripting, focus, manager } = useMemo(() => {
    const manager = new UndoManager();
    const studio = new CommandScope('studio');
    // Bind the undo BEHAVIOR to the `undo` scope's lifetime at creation (no separate useEffect): the
    // contributor is passed by reference with its arg, runs now, and its disposer fires on dispose().
    const undo = studio.createChild('undo', contributeUndoCommands, { manager });
    const workbook = undo.createChild('workbook');
    const sheet = workbook.createChild('sheet');
    const selection = sheet.createChild('selection');
    const editor = selection.createChild('editor');     // deeper child = higher z
    const scripting = workbook.createChild('scripting'); // sibling branch
    seedUndoChrome(studio);                                 // catalog chrome (story-local seed)
    studio.updateCommand('undo', { icon: '↶' });         // story-only: emoji icons read better than the 'Undo'/'Redo' tokens
    studio.updateCommand('redo', { icon: '↷' });
    return { studio, sheet, editor, scripting, focus: new FocusActivation(null, sheet), manager };
  }, []);

  // The "document": a counter; each action is an undoable step (revert ↔ redo).
  const [count, setCount] = useState(0);
  const [, force] = useState(0);
  useEffect(() => manager.addListener({ onStackChange: () => force((n) => n + 1) }), [manager]);

  const doAction = (): void => {
    // Side-effect (push) kept OUT of the setState updater so StrictMode's double-invoke can't push twice.
    const next = count + 1;
    setCount(next);
    manager.addUndoOperation({
      description: `Edit #${next}`,
      undo: () => { setCount(next - 1); return () => setCount(next); } // returns the redo
    });
  };

  const [anchorKey, setAnchorKey] = useState('sheet');
  useEffect(() => {
    // (The cold-start anchor is the tracker's ctor `initialAnchor` — `sheet`, above.)
    return focus.subscribe(() => setAnchorKey(focus.getAnchor()?.key ?? '(root)'));
  }, [focus]);

  useEffect(() => {
    if (!rootElRef.current) return;
    return focus.attach(rootElRef.current);
  }, [focus]);

  return (
    <CommandScopeContext.Provider value={studio}>
      <div ref={rootElRef} style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0 }}>Undo/Redo — dynamic disable + description (recipe-setter)</h3>

        {/* Toolbar resolves against the focus anchor; undo/redo live up on the `Undo` ancestor scope. */}
        <CommandAnchorProvider tracker={focus}>
          <div style={{ ...rowStyle, border: '1px solid #ddd', borderRadius: 6, padding: '4px 12px' }}>
            <CommandButton commandKey="undo" />
            <CommandButton commandKey="redo" />
            <span style={{ width: 1, height: 24, background: '#ddd' }} />
            <button onClick={doAction} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #1971c2', background: '#e7f5ff', cursor: 'pointer' }}>
              Do action (Edit #{count + 1})
            </button>
            <span style={{ color: '#888' }}>doc value: <b style={{ color: '#222' }}>{count}</b></span>
          </div>
        </CommandAnchorProvider>

        {/* The tree's leaves — focus any of them; undo/redo stay resolvable from all (ancestor placement). */}
        <div style={{ display: 'flex', gap: 12 }}>
          <FocusPanel title="Sheet" hint="anchor: sheet → workbook → undo → studio" accent="#1971c2" active={anchorKey === 'sheet'} scope={sheet} focus={focus}>
            <FocusPanel
              title="Editor (deeper z)" hint="anchor: editor → selection → sheet → … → undo" accent="#d9480f"
              active={anchorKey === 'editor'} scope={editor} focus={focus}
            />
          </FocusPanel>
          <FocusPanel title="Scripting (TaskPane)" hint="anchor: scripting → workbook → undo → studio" accent="#7048e8" active={anchorKey === 'scripting'} scope={scripting} focus={focus} />
        </div>
        {/* `selection` is an intermediate scope in the chain (no anchor element of its own here). */}

        <div style={{ display: 'flex', gap: 24, color: '#888' }}>
          <span>anchor: <b>{anchorKey}</b></span>
          <span>top undo: <b style={{ color: '#222' }}>{manager.getTopUndoDescription() ?? '—'}</b></span>
          <span>top redo: <b style={{ color: '#222' }}>{manager.getTopRedoDescription() ?? '—'}</b></span>
        </div>

        <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5 }}>
          Click <b>Do action</b> a few times → <i>Undo</i> enables and its tooltip/label becomes
          <b> "Undo Edit #n"</b> (dynamic description from the stack). Click <i>Undo</i> → the doc value
          reverts and <i>Redo</i> enables as <b>"Redo Edit #n"</b>. Undo to empty → <i>Undo</i> disables
          (<code>title="Nothing to undo"</code>). Now focus the <b>Editor</b> (deepest) or the
          <b> Scripting</b> branch — undo/redo stay fully resolvable from either, because the behavior
          lives on the <b>Undo</b> scope above them all. Same dynamic-disable/description recipe that the
          sheet's disable-block needs, in ~15 lines.
        </div>
      </div>
    </CommandScopeContext.Provider>
  );
};

export const UndoRedo = asStory(Template);
UndoRedo.args = {};
UndoRedo.storyName = 'Undo/Redo (recipe-setter)';

const Story = { title: 'Commands' };
export default Story;
