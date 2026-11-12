import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, RangeTooltip, RangeTooltipProvider, TooltipProvider
} from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **`RangeTooltip` — a tip declared on a range.** No layer, no probe: `<RangeTooltip range content />`
 * where the tip is wanted, and the grid's own host draws it. Every declared tip is in the grid's tooltip
 * group (the provider's timing, one tip at a time, closed by a press or a key).
 *
 * - **Sales** (blue) — an **interactive** card with a button: move onto it and it stays. `bubble: false`,
 *   so the card draws its own chrome and spreads `tipProps`.
 * - **Inventory** (blue) — a plain bubble, the grid's default.
 * - **Q3 figures** (green, inside Sales) — the **smaller** range wins where two overlap.
 * - **Column A** — declared **outside the grid**, under the `RangeTooltipProvider` that encloses it.
 * - **Counter** (amber) — content that changes while the tip is open: the open tip follows it.
 */

const SALES: RangeCoords = { rowStart: 3, colStart: 2, rowEnd: 8, colEnd: 5 };
const INVENTORY: RangeCoords = { rowStart: 12, colStart: 6, rowEnd: 16, colEnd: 10 };
const Q3: RangeCoords = { rowStart: 5, colStart: 3, rowEnd: 6, colEnd: 4 };
const COLUMN_A: RangeCoords = { rowStart: 0, colStart: 0, rowEnd: 199, colEnd: 0 };
const COUNTER: RangeCoords = { rowStart: 20, colStart: 2, rowEnd: 20, colEnd: 4 };

const CARD_STYLE: React.CSSProperties = {
  font: '12px system-ui, sans-serif', background: 'white', color: '#222',
  border: '1px solid #ccc', borderRadius: 6, padding: 8, minWidth: 150,
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 6
};
const BTN: React.CSSProperties = {
  font: '12px system-ui', padding: '3px 10px', borderRadius: 4, border: '1px solid #bbb', cursor: 'pointer'
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
  enterDelay: number;
  leaveDelay: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, enterDelay, leaveDelay, ...rest } = props;
  const [log, setLog] = useState<string>('—');
  const [count, setCount] = useState<number>(0);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ font: '12px monospace', padding: '4px 6px', color: '#555', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>Hover a region · last action: <b>{log}</b></span>
          <button style={BTN} onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
        </div>
        <TooltipProvider timing={{ enterDelay, leaveDelay }}>
          <RangeTooltipProvider>
            {/* Declared outside the grid: registers with the provider around both. */}
            <RangeTooltip range={COLUMN_A} placement={{ side: 'r' }} offset={4} content="Column A, declared outside the grid" />
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
              <Layer key="regions">
                <RangeRect range={SALES} stroke="rgb(90,90,200)" alignWidth={1.5} fill="rgba(90,90,200,0.08)" />
                <RangeRect range={INVENTORY} stroke="rgb(90,90,200)" alignWidth={1.5} fill="rgba(90,90,200,0.08)" />
                <RangeRect range={Q3} stroke="rgb(60,160,90)" alignWidth={1.5} fill="rgba(60,160,90,0.10)" />
                <RangeRect range={COUNTER} stroke="rgb(220,160,40)" alignWidth={1.5} fill="rgba(220,160,40,0.12)" />
              </Layer>
              <RangeTooltip
                key="sales"
                range={SALES}
                placement={{ side: 't' }}
                interactive
                bubble={false}
                content={({ tipProps }) => (
                  <div {...tipProps} style={{ ...CARD_STYLE, ...tipProps.style }}>
                    <b>Sales</b>
                    <button style={BTN} onClick={() => setLog('Edit Sales')}>Edit</button>
                  </div>
                )}
              />
              <RangeTooltip key="inventory" range={INVENTORY} placement={{ side: 'b', align: 'start' }} offset={4} content="Inventory" />
              <RangeTooltip key="q3" range={Q3} placement={{ side: 'b', align: 'start' }} offset={4} content="Q3 figures are provisional" />
              <RangeTooltip key="counter" range={COUNTER} placement={{ side: 'r' }} content={`Count is ${count}`} />
            </Grid>
          </RangeTooltipProvider>
        </TooltipProvider>
      </div>
    </div>
  );
};

export const RangeTooltipDeclared = asStory(Template);
RangeTooltipDeclared.args = {
  columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3,
  enterDelay: 300, leaveDelay: 400
};
RangeTooltipDeclared.storyName = 'Range tooltip, declared (no layer, no probe)';

const Story = {
  title: 'Float',
  component: RangeTooltipDeclared,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
