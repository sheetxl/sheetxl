import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, StickyAnchor,
  type GridFloatSide, type GridAlign, type GridWhenOff
} from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **StickyAnchor — positioning a plain `<div>` (no portal).**
 *
 * `StickyAnchor` resolves the anchor and positions its child **inline** at the (clamped) anchor. The
 * child here is literally just a `<div>` — no `createPortal`, no FloatPopper — so the story tests one
 * thing: does the anchor track / clamp correctly. It lives in the owner pane's Stage (so it clips with
 * the pane; that's the inline trade-off — portal only when a label must overhang).
 *
 * `side` = primary axis, `align` = secondary. The anchor is clamped per axis into the owner pane's
 * visible rect, so it **slides** to stay in view. `whenOff: hide` drops it once the range leaves every
 * pane; `clamp` keeps it pinned at the edge (the child can read `slid` via `useSticky`).
 */

const RANGE: RangeCoords = { rowStart: 6, colStart: 5, rowEnd: 10, colEnd: 9 };

const SIDES: GridFloatSide[] = ['t', 'r', 'b', 'l'];
const ALIGNS: GridAlign[] = ['start', 'center', 'end'];

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
  const [whenOff, setWhenOff] = useState<GridWhenOff>('hide');

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '2px 8px', font: '12px monospace', cursor: 'pointer',
    background: active ? 'rgb(0,120,215)' : '#eee', color: active ? 'white' : '#333',
    border: '1px solid #bbb', borderRadius: 3
  });

  const text = `${RANGE.rowStart}:${RANGE.colStart}…${RANGE.rowEnd}:${RANGE.colEnd}`;

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
            <RangeRect range={RANGE} stroke="rgb(0,120,215)" alignWidth={2} fill="rgba(0,120,215,0.10)" />
          </Layer>
          <Layer key="sticky">
          <StickyAnchor anchor={{ range: RANGE }} placement={{ side, align }} whenOff={whenOff}>
            {/* just a div — StickyAnchor positions it */}
            <div style={{
              font: '11px/1.6 system-ui, sans-serif', color: 'white', background: 'rgb(0,120,215)',
              padding: '0 8px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
            }}>
              {text}
            </div>
          </StickyAnchor>
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const Sticky = asStory(Template);
Sticky.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
Sticky.storyName = 'StickyAnchor (plain div)';

const Story = {
  title: 'Float',
  component: Sticky,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
