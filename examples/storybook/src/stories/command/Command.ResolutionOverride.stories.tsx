import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Command, KeyModifiers } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, FocusActivation, CommandScopeContext, CommandAnchorProvider } = Command;

/**
 * Resolution override via nested scopes. One key (`whoami`); the icon + shortcut are
 * contributed **once** at the root, and each nested scope **overrides the label and the
 * callback**. Which scope is the anchor is decided by focus (`FocusActivation`), so clicking
 * into a deeper region re-resolves the *same* button to the more-specific label — and the
 * *same* keyboard shortcut (Ctrl/⌘+I) dispatches the more-specific callback. Key dispatch
 * goes through the identical anchor/override resolution as the button.
 */
const Template: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [lastRan, setLastRan] = useState('—');
  const ranRef = useRef(setLastRan);
  ranRef.current = setLastRan;

  const { app, sheet, editor, focus } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const editor = sheet.createChild('editor');
    // Root owns the shared bits (icon + shortcut); nested scopes override label AND callback.
    app.updateCommand('whoami', {
      icon: '🧭',
      label: 'Nowhere special',
      shortcut: { key: 'I', modifiers: [KeyModifiers.Ctrl] },
      callback: () => ranRef.current('ran: app')
    });
    sheet.updateCommand('whoami', {
      label: 'On the Sheet',
      callback: () => ranRef.current('ran: sheet')
    });
    editor.updateCommand('whoami', {
      label: 'In the Cell Editor',
      callback: () => ranRef.current('ran: editor')
    });
    return { app, sheet, editor, focus: new FocusActivation() };
  }, []);

  // Live readout of which scope the focus tracker currently anchors to.
  const [anchorKey, setAnchorKey] = useState(() => focus.getAnchor()?.key ?? '(root)');
  useEffect(() => focus.subscribe(() => setAnchorKey(focus.getAnchor()?.key ?? '(root)')), [focus]);

  // NOTE: this is the **manual** form — you would almost never hand-roll attach/register in
  // real code. A feature-region provider creates its scope (`parent.createChild`) and lets
  // `CommandScopeContext` dispose it on unmount, and registers/unregisters its element with
  // the tracker. It's inlined here only so the focus→scope wiring is visible. (Same spirit as
  // keybinds being baked into the resolver rather than wired by hand.)
  useEffect(() => {
    if (!rootRef.current) return;
    const detach = focus.attach(rootRef.current);
    const removers: Array<() => void> = [];
    if (appRef.current) removers.push(focus.register(appRef.current, app));
    if (sheetRef.current) removers.push(focus.register(sheetRef.current, sheet));
    if (editorRef.current) removers.push(focus.register(editorRef.current, editor));
    return () => { detach(); removers.forEach((r) => r()); };
  }, [focus, app, sheet, editor]);

  const regionStyle = (key: string): React.CSSProperties => ({
    padding: 12,
    marginTop: 8,
    borderRadius: 4,
    outline: 'none',
    cursor: 'pointer',
    border: `2px solid ${anchorKey === key ? '#3b82f6' : '#ccc'}`,
    background: anchorKey === key ? '#eaf2ff' : '#fafafa'
  });

  return (
    <CommandScopeContext.Provider value={app}>
      <CommandAnchorProvider tracker={focus}>
        {/* Keybinds are automatic: the resolver binds them to the focus tracker's region. */}
        <div ref={rootRef} style={{ fontFamily: 'sans-serif', padding: 16 }}>
          <h3>Resolution Override — one button + one shortcut, both follow focus</h3>
          <div style={rowStyle}>
            <CommandButton commandKey="whoami" />
            <span style={{ color: '#888' }}>anchored to: <b>{anchorKey}</b></span>
            <span style={{ color: '#888' }}>last shortcut: <b>{lastRan}</b></span>
          </div>

          {/* Nested registered regions: app ⊃ sheet ⊃ editor. */}
          <div ref={appRef} tabIndex={0} style={regionStyle('app')}>
            App level — click here (root default)
            <div ref={sheetRef} tabIndex={0} style={regionStyle('sheet')}>
              Sheet — click here
              <div ref={editorRef} tabIndex={0} style={regionStyle('editor')}>
                Cell editor — click here (most specific)
              </div>
            </div>
          </div>

          <p style={{ color: '#888', maxWidth: 600 }}>
            The button's <b>icon</b> (🧭) and the <b>Ctrl/⌘+I</b> shortcut come from the root and
            never change. Click a deeper region and only the <b>label</b> re-resolves — <i>Nowhere
            special</i> → <i>On the Sheet</i> → <i>In the Cell Editor</i>. Now press <b>Ctrl/⌘+I</b>
            in each region: the <i>last shortcut</i> readout shows the dispatcher ran the
            <b> overriding</b> callback for the focused scope — key dispatch resolves through the
            exact same anchor/override path as the button.
          </p>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const ResolutionOverride = asStory(Template);
ResolutionOverride.storyName = 'Resolution Override';

const Story = { title: 'Commands' };
export default Story;
