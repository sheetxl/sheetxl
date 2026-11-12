import React, { useMemo } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider, useCommandExecute } = Command;

const FireButton: React.FC = () => {
  const execute = useCommandExecute(); // bound to this container's resolver (anchor = sheet)
  return (
    <button onClick={() => execute('copy')} style={{ padding: '6px 10px' }}>
      Fire copy imperatively
    </button>
  );
};

const Template: React.FC = () => {
  const { app, sheet } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('copy', { label: 'Copy', icon: '📋' });
    app.updateCommand('paste', { label: 'Paste', icon: '📥' });
    sheet.updateCommand('copy', { callback: () => console.log('copy executed') });
    sheet.updateCommand('paste', { callback: () => {}, disabledReasons: ['Clipboard is empty'] });
    return { app, sheet };
  }, []);
  // This container pins its anchor to the sheet (no focus regions in this story).
  const tracker = useMemo(() => new ManualActivation(sheet), [sheet]);

  return (
    <CommandScopeContext.Provider value={app}>
      <CommandAnchorProvider tracker={tracker}>
        <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
          <h3>Imperative — per-key execute / dual ripple</h3>
          <div style={rowStyle}>
            <span style={{ width: 120, color: '#666' }}>Toolbar:</span>
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="paste" />
          </div>
          <div style={rowStyle}>
            <span style={{ width: 120, color: '#666' }}>Context menu:</span>
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="paste" />
          </div>
          <div style={rowStyle}>
            <span style={{ width: 120, color: '#666' }}>Imperative:</span>
            <FireButton />
            <span style={{ color: '#888' }}>→ both "Copy" buttons ripple (one per-key execute event)</span>
          </div>
          <p style={{ color: '#888', maxWidth: 560 }}>
            Label/icon from the app scope, action/veto from the sheet scope (cascade). A button
            just calls <code>cmd.execute()</code>; the imperative button calls the resolver's
            <code> execute('copy')</code>.
          </p>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const Imperative = asStory(Template);
Imperative.storyName = 'Imperative';

const Story = { title: 'Commands' };
export default Story;
