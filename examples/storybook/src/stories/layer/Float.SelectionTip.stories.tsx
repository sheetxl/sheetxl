import React, { useMemo } from 'react';

import { CoordUtils, type RangeCoords, type CellCoords } from '@sheetxl/utils';

import {
  SelectionLayer, DefaultSelection, RangeTooltipLayer, type SelectionGesture, type RangeFloatTarget
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, sharedCellRenderer, asStory } from '../../components';

/**
 * **`SelectionLayer` gesture tips.** A `renderTip(gesture)` prop says what a gesture reads out; the layer
 * draws it as a `GestureTip` on the in-flight range, in the tooltip group's bubble:
 * - **drag-select** → live `R×C` (skips a plain 1×1 click by returning `null`);
 * - **move** (drag the selection border) → the destination address — Ctrl / Shift mid-drag keep it up;
 * - **fill** (drag the bottom-right handle) → the fill `R×C`, trailing the edge the fill grows from
 *   (beside the last row going down, under the last column going right).
 *
 * A gesture tip **holds the tooltip group**: column A has a hover tip (`Row n`), and it does not open
 * while a drag passes over it — nor at once when the drag ends there.
 */

const colToLetters = (col: number): string => {
  let s = ''; let n = col;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};
const rangeToA1 = (r: RangeCoords): string => {
  const a = `${colToLetters(r.colStart)}${r.rowStart + 1}`;
  const b = `${colToLetters(r.colEnd)}${r.rowEnd + 1}`;
  return a === b ? a : `${a}:${b}`;
};
const dims = (r: RangeCoords): string => `${r.rowEnd - r.rowStart + 1}R × ${r.colEnd - r.colStart + 1}C`;

const renderTip = (g: SelectionGesture): React.ReactNode => {
  if (g.kind === 'select') {
    const { rowStart, colStart, rowEnd, colEnd } = g.range;
    if (rowStart === rowEnd && colStart === colEnd) return null; // no tip for a plain click
    return dims(g.range);
  }
  if (g.kind === 'move') return rangeToA1(g.to);
  return dims(g.destination); // fill
};

const probeRow = (coords: CellCoords): RangeFloatTarget<number> | null => {
  if (coords.colIndex !== 0) return null;
  return { range: CoordUtils.cellToRange(coords)!, data: coords.rowIndex + 1 };
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 }),
    initial: { cell: { rowIndex: 8, colIndex: 5 }, ranges: [{ rowStart: 8, colStart: 5, rowEnd: 10, colEnd: 7 }], rangeIndex: 0 }
  }), [rowCount, columnCount]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ font: '12px monospace', padding: '4px 6px', color: '#555' }}>
          Drag to select (R×C) · drag the selection border to move (address) · drag the fill handle (R×C) · column A has a hover tip
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
          <SelectionLayer selection={selection} enabledMove enableFill renderTip={renderTip} />
          <RangeTooltipLayer probe={probeRow} placement={{ side: 'r', align: 'center' }}>
            {({ data }) => `Row ${data}`}
          </RangeTooltipLayer>
        </Grid>
      </div>
    </div>
  );
};

export const SelectionTip = asStory(Template);
SelectionTip.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
SelectionTip.storyName = 'Selection gesture tips';

const Story = {
  title: 'Float',
  component: SelectionTip,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
