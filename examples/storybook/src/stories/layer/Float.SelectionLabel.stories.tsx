import React, { useMemo, useState } from 'react';

import { type RangeCoords, type SelectionCoords } from '@sheetxl/utils';
import { useBoundSyncExternalStore } from '@sheetxl/utils-react';

import {
  Layer, SelectionLayer, DefaultSelection, StickyAnchor, StickyPortal,
  type ISelection, type GridFloatSide, type GridAlign
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, sharedCellRenderer, asStory } from '../../components';

/**
 * **A label on a selection — `StickyAnchor` (inline `<div>`) vs `StickyPortal` (portal).**
 *
 * `render: inline` → `<StickyAnchor>` with a plain `<div>` — positioned in the owner pane's Stage, so it
 * **clips** with the pane. `render: portal` → `<StickyPortal>` — the ergonomic portal wrapper; it
 * **escapes the clip** and can flow past the pane bounds (e.g. overhang the freeze line). Same anchor
 * math; only the render target differs.
 */

const activeRange = (sel: SelectionCoords): RangeCoords => {
  const r = sel.ranges?.[sel.rangeIndex ?? 0];
  if (r) return r;
  const { rowIndex, colIndex } = sel.cell;
  return { rowStart: rowIndex, colStart: colIndex, rowEnd: rowIndex, colEnd: colIndex };
};

const LABEL_STYLE: React.CSSProperties = {
  font: '11px/1.6 system-ui, sans-serif', color: 'white', background: 'rgb(0,120,215)',
  padding: '0 6px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none',
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
};

const SelectionLabel: React.FC<{ selection: ISelection; side: GridFloatSide; align: GridAlign; portal: boolean }> =
  ({ selection, side, align, portal }) => {
  const sel = useBoundSyncExternalStore(selection, (s) => s.getSelection());
  const range = activeRange(sel);
  const rows = range.rowEnd - range.rowStart + 1;
  const cols = range.colEnd - range.colStart + 1;
  const text = `${rows}R × ${cols}C`;
  return (
    <Layer>
      {portal ? (
        <StickyPortal anchor={{ range }} placement={{ side, align }} whenOff="hide" style={LABEL_STYLE}>
          {text}
        </StickyPortal>
      ) : (
        <StickyAnchor anchor={{ range }} placement={{ side, align }} whenOff="hide">
          <div style={LABEL_STYLE}>{text}</div>
        </StickyAnchor>
      )}
    </Layer>
  );
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const SIDES: GridFloatSide[] = ['t', 'r', 'b', 'l'];
const ALIGNS: GridAlign[] = ['start', 'center', 'end'];

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;
  const [side, setSide] = useState<GridFloatSide>('t');
  const [align, setAlign] = useState<GridAlign>('center');
  const [portal, setPortal] = useState<boolean>(false);

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 }),
    initial: { cell: { rowIndex: 8, colIndex: 5 }, ranges: [{ rowStart: 8, colStart: 5, rowEnd: 11, colEnd: 8 }], rangeIndex: 0 }
  }), [rowCount, columnCount]);

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
          <span style={{ font: '12px monospace', marginLeft: 6 }}>render:</span>
          {([['inline', false], ['portal', true]] as const).map(([label, v]) =>
            <button key={label} style={btn(v === portal)} onClick={() => setPortal(v)}>{label}</button>)}
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
          <SelectionLayer key="selection" selection={selection} enabledMove />
          <SelectionLabel key="selection-label" selection={selection} side={side} align={align} portal={portal} />
        </Grid>
      </div>
    </div>
  );
};

export const SelectionLabelStory = asStory(Template);
SelectionLabelStory.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
SelectionLabelStory.storyName = 'Selection label (inline vs portal)';

const Story = {
  title: 'Float',
  component: SelectionLabelStory,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
