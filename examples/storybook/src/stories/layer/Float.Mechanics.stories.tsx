import React, { useState } from 'react';
import { createPortal } from 'react-dom';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, StickyAnchor,
  type StickyState, type GridFloatSide, type GridAlign, type GridWhenOff
} from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **Mechanics probe** — visualizes what `StickyAnchor` resolves, using only its public render-prop
 * (`(state) => …`), so nothing here reaches into the internal anchor engine.
 *
 * The **range** is a `<RangeRect>` straddling the freeze. The overlay (portalled) shows the resolved
 * **anchor point** (red dot) + `owner` / `slid`. Change `side` / `align` to see the per-axis pane pick
 * (each axis resolves independently); scroll under the freeze to watch it slide (opposite axis) and the
 * owner jump between panes. `whenOff: clamp` keeps it pinned (with `slid`); `hide` drops it.
 */

const STRADDLE: RangeCoords = { rowStart: 2, colStart: 2, rowEnd: 9, colEnd: 8 };

const SIDES: GridFloatSide[] = ['t', 'r', 'b', 'l'];
const ALIGNS: GridAlign[] = ['start', 'center', 'end'];

const Marker: React.FC<{ state: StickyState }> = ({ state }) => {
  const { anchorPoint, owner, clipped, slid } = state;
  return createPortal(
    <>
      <div style={{
        position: 'fixed', left: anchorPoint.x - 5, top: anchorPoint.y - 5, width: 10, height: 10,
        borderRadius: '50%', background: 'red', border: '1.5px solid white', pointerEvents: 'none', zIndex: 1251
      }} />
      <div style={{
        position: 'fixed', left: anchorPoint.x + 8, top: anchorPoint.y - 8,
        font: '11px/1.4 monospace', color: '#b00', background: 'rgba(255,255,255,0.9)', padding: '0 4px',
        pointerEvents: 'none', zIndex: 1251, whiteSpace: 'nowrap'
      }}>
        owner={String(owner)} @({Math.round(anchorPoint.x)},{Math.round(anchorPoint.y)})
        {clipped ? ' · clipped' : ''}{slid ? ` · slid ${Math.round(slid.distance)}px ${slid.direction}` : ''}
      </div>
    </>,
    document.body
  );
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;
  const [side, setSide] = useState<GridFloatSide>('t');
  const [align, setAlign] = useState<GridAlign>('center');
  const [whenOff, setWhenOff] = useState<GridWhenOff>('clamp');

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '2px 8px', font: '12px monospace', cursor: 'pointer',
    background: active ? 'rgb(0,120,215)' : '#eee', color: active ? 'white' : '#333',
    border: '1px solid #bbb', borderRadius: 3
  });

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 6px', flexWrap: 'wrap' }}>
          <span style={{ font: '12px monospace' }}>side:</span>
          {SIDES.map((s) => <button key={s} style={btn(s === side)} onClick={() => setSide(s)}>{s}</button>)}
          <span style={{ font: '12px monospace', marginLeft: 6 }}>align:</span>
          {ALIGNS.map((a) => <button key={a} style={btn(a === align)} onClick={() => setAlign(a)}>{a}</button>)}
          <span style={{ font: '12px monospace', marginLeft: 6 }}>whenOff:</span>
          {(['hide', 'clamp'] as GridWhenOff[]).map((w) =>
            <button key={w} style={btn(w === whenOff)} onClick={() => setWhenOff(w)}>{w}</button>)}
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
            <RangeRect range={STRADDLE} stroke="rgb(0,120,215)" alignWidth={2} fill="rgba(0,120,215,0.10)" />
          </Layer>
          <Layer key="sticky">
            <StickyAnchor anchor={{ range: STRADDLE }} placement={{ side, align }} whenOff={whenOff}>
              {(s) => <Marker state={s} />}
            </StickyAnchor>
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const Mechanics = asStory(Template);
Mechanics.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
Mechanics.storyName = 'Mechanics (per-axis resolve)';

const Story = {
  title: 'Float',
  component: Mechanics,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
