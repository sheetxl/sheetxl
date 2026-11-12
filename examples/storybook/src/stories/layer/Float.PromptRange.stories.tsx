import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import { Layer, RangeRect, RangePrompt } from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **`RangePrompt` — a persistent prompt pinned to a range** (the "presence" flavor, always open).
 * While the range is in view it shows the client content (here an AI-style question + option buttons)
 * with a small cancel (×). **Scroll the range out of view** and it clamps to the edge as an arrow +
 * "Go to range" pill (click reveals it via `scrollIntoView`). Cancel unmounts it (controlled by the host).
 */

const RANGE: RangeCoords = { rowStart: 10, colStart: 4, rowEnd: 14, colEnd: 7 };

const OPT_BTN: React.CSSProperties = {
  font: '12px system-ui', padding: '4px 10px', borderRadius: 6, border: '1px solid #bbb',
  background: '#f4f4f6', cursor: 'pointer'
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;
  const [open, setOpen] = useState<boolean>(true);
  const [log, setLog] = useState<string>('—');

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ font: '12px monospace', padding: '4px 6px', color: '#555', display: 'flex', gap: 12 }}>
          <span>Prompt on E11:H15 · scroll it off-screen for the goto pill · last: <b>{log}</b></span>
          <button
            style={{ ...OPT_BTN, opacity: open ? 0.5 : 1, cursor: open ? 'default' : 'pointer' }}
            disabled={open}
            onClick={() => { setOpen(true); setLog('reopened'); }}
          >Reopen</button>
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          renderCells={sharedCellRenderer}
          showGridLines
          freezeTop={freezeTop}
          freezeLeft={freezeLeft}
          style={{ width: '100%', height: '100%', border: '1px solid black' }}
        >
          <Layer key="range">
            <RangeRect range={RANGE} stroke="rgb(120,80,200)" alignWidth={2} fill="rgba(120,80,200,0.10)" />
          </Layer>
          {open && (
            <RangePrompt
              range={RANGE}
              placement={{ side: 't', align: 'start' }}
              onCancel={() => { setOpen(false); setLog('cancelled'); }}
              onGoto={(state) => { state.scrollIntoView(); setLog('goto'); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 16 }}>
                <div style={{ font: '13px system-ui' }}>Ask about <b>E11:H15</b></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={OPT_BTN} onClick={() => setLog('summarize')}>Summarize</button>
                  <button style={OPT_BTN} onClick={() => setLog('chart')}>Chart it</button>
                  <button style={OPT_BTN} onClick={() => setLog('explain')}>Explain</button>
                </div>
              </div>
            </RangePrompt>
          )}
        </Grid>
      </div>
    </div>
  );
};

export const PromptRange = asStory(Template);
PromptRange.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
PromptRange.storyName = 'Prompt range (presence + goto)';

const Story = {
  title: 'Float',
  component: PromptRange,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
