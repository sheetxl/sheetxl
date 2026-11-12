import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, FocusActivation, CommandScopeContext, CommandAnchorProvider } = Command;

const Template: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scriptingRef = useRef<HTMLDivElement>(null);

  const { app, sheet, scripting, focus } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const scripting = app.createChild('scripting');
    app.updateCommand('copy', { label: 'Copy', icon: '📋' });
    sheet.updateCommand('copy', { callback: () => console.log('copy') });
    scripting.updateCommand('run', { label: 'Run', icon: '▶', callback: () => console.log('run') });
    return { app, sheet, scripting, focus: new FocusActivation() };
  }, []);

  // Live "active" indicator straight off the focus tracker.
  const [activeKey, setActiveKey] = useState(() => focus.getAnchor()?.key ?? '(none)');
  useEffect(() => focus.subscribe(() => setActiveKey(focus.getAnchor()?.key ?? '(none)')), [focus]);

  // NOTE: this is the **manual** form — you would almost never hand-roll attach/register in
  // real code. A feature-region provider creates its scope (`parent.createChild`) and lets
  // `CommandScopeContext` dispose it on unmount, and registers/unregisters its element with
  // the tracker. It's inlined here only so the focus→scope wiring is visible. (Same spirit as
  // keybinds being baked into the resolver rather than wired by hand.)
  useEffect(() => {
    if (!rootRef.current) return;
    const detach = focus.attach(rootRef.current);
    const removers: Array<() => void> = [];
    if (sheetRef.current) removers.push(focus.register(sheetRef.current, sheet));
    if (scriptingRef.current) removers.push(focus.register(scriptingRef.current, scripting));
    return () => { detach(); removers.forEach((r) => r()); };
  }, [focus, sheet, scripting]);

  const region = (key: string, label: string, ref: React.Ref<HTMLDivElement>): React.ReactNode => (
    <div
      ref={ref}
      tabIndex={0}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 4,
        outline: 'none',
        border: `2px solid ${activeKey === key ? '#3b82f6' : '#ccc'}`,
        background: activeKey === key ? '#eaf2ff' : '#fafafa'
      }}
    >
      {label} {activeKey === key ? '(active)' : ''}
    </div>
  );

  return (
    <CommandScopeContext.Provider value={app}>
      <CommandAnchorProvider tracker={focus} debounce={150}>
        <div ref={rootRef} style={{ fontFamily: 'sans-serif', padding: 16 }}>
          <h3>Focus Handoff — the toolbar's resolver tracks focus</h3>
          <div style={rowStyle}>
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="run" />
            <span style={{ color: '#888' }}>active: <b>{activeKey}</b></span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {region('sheet', 'Sheet area — click to focus', sheetRef)}
            {region('scripting', 'Scripting area — click to focus', scriptingRef)}
          </div>
          <p style={{ color: '#888', maxWidth: 560 }}>
            Focus the <b>Sheet area</b> → <b>Copy</b> enables, <b>Run</b> disables. Focus the
            <b> Scripting area</b> → the reverse. Focusing a button (chrome) leaves the anchor
            unchanged.
          </p>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const FocusHandoff = asStory(Template);
FocusHandoff.storyName = 'Focus Handoff';

const Story = { title: 'Commands' };
export default Story;
