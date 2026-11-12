import React, { useMemo, useState } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider } = Command;

const Template: React.FC = () => {
  const { app, sheet, scripting } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const scripting = app.createChild('scripting');
    app.updateCommand('copy', { label: 'Copy', icon: '📋' });
    sheet.updateCommand('copy', { callback: () => console.log('copy (from context menu)') });
    scripting.updateCommand('run', { label: 'Run', icon: '▶', callback: () => console.log('run') });
    return { app, sheet, scripting };
  }, []);

  // Main toolbar pinned to scripting (so "Copy" is off-chain → disabled).
  const mainTracker = useMemo(() => new ManualActivation(scripting), [scripting]);
  // The context menu is a SEPARATE resolver anchored to the sheet snapshot.
  const menuTracker = useMemo(() => new ManualActivation(sheet), [sheet]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <CommandScopeContext.Provider value={app}>
      <CommandAnchorProvider tracker={mainTracker}>
        <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
          <h3>Context Menu — its own resolver (a parallel anchor)</h3>
          <div style={rowStyle}>
            <span style={{ width: 180, color: '#666' }}>Main toolbar (anchor: scripting):</span>
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="run" />
          </div>
          <div style={rowStyle}>
            <span style={{ width: 180, color: '#666' }}>Sheet:</span>
            <button onClick={() => setMenuOpen((o) => !o)} style={{ padding: '6px 10px' }}>
              Right-click a sheet cell ▾
            </button>
          </div>

          {menuOpen && (
            <CommandAnchorProvider tracker={menuTracker}>
              <div style={{
                border: '1px solid #bbb', borderRadius: 4, width: 220, padding: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', background: 'white'
              }}>
                <CommandButton commandKey="copy" onExecuted={() => setMenuOpen(false)} />
              </div>
            </CommandAnchorProvider>
          )}

          <p style={{ color: '#888', maxWidth: 560 }}>
            Main <b>Copy</b> is disabled (its resolver's anchor is scripting), but the context
            menu has its <b>own resolver</b> anchored to the sheet → Copy <b>enabled</b>. Picking
            it ripples the main Copy button (per-key event across resolvers); the main toolbar's
            anchor is untouched.
          </p>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const ContextMenu = asStory(Template);
ContextMenu.storyName = 'Context Menu (own resolver)';

const Story = { title: 'Commands' };
export default Story;
