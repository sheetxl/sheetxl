import React, { useMemo } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider } = Command;

const Template: React.FC = () => {
  const { app, sheet } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('cellInfo', { label: 'Cell 0', callback: () => {} });
    return { app, sheet };
  }, []);

  // Two containers over one registry, both anchored to the sheet — different cadences.
  const immediate = useMemo(() => new ManualActivation(sheet), [sheet]);
  const debounced = useMemo(() => new ManualActivation(sheet), [sheet]);

  const spin = (): void => {
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      sheet.updateCommand('cellInfo', { label: `Cell ${i}` }); // re-contribution stream
      if (i >= 20) window.clearInterval(id);
    }, 30);
  };

  return (
    <CommandScopeContext.Provider value={app}>
      <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
        <h3>Debounced — cadence is per-container (on the resolver)</h3>
        <div style={rowStyle}>
          <span style={{ width: 160, color: '#666' }}>Immediate:</span>
          <CommandAnchorProvider tracker={immediate}>
            <CommandButton commandKey="cellInfo" />
          </CommandAnchorProvider>
        </div>
        <div style={rowStyle}>
          <span style={{ width: 160, color: '#666' }}>Debounced (150ms):</span>
          <CommandAnchorProvider tracker={debounced} debounce={150}>
            <CommandButton commandKey="cellInfo" />
          </CommandAnchorProvider>
        </div>
        <div style={rowStyle}>
          <button onClick={spin} style={{ padding: '6px 10px' }}>Spin "selection" ×20 (30ms each)</button>
        </div>
        <p style={{ color: '#888', maxWidth: 560 }}>
          Same registry, two resolvers: the immediate one updates every tick during the spin;
          the <code>debounce={'{150}'}</code> one re-resolves only after the burst settles.
          The cadence lives on each container's resolver — actions stay immediate.
        </p>
      </div>
    </CommandScopeContext.Provider>
  );
};

export const Debounced = asStory(Template);
Debounced.storyName = 'Debounced';

const Story = { title: 'Commands' };
export default Story;
