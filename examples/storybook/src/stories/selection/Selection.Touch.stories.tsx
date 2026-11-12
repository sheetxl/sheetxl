import React, { useCallback, useMemo } from 'react';

import { type SelectionCoords, type RangeCoords } from '@sheetxl/utils';
import { useBoundSyncExternalStore } from '@sheetxl/utils-react';

import {
  Grid, SelectionLayer, SelectionTouchGrips, DefaultSelection, DefaultCellRenderer,
  type CellRendererProps, type ISelection
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

const SelectionReadout: React.FC<{ selection: ISelection }> = ({ selection }) => {
  const coords: SelectionCoords = useBoundSyncExternalStore(selection, (s) => s.getSelection());
  const fmt = (r: RangeCoords): string => `(${r.rowStart},${r.colStart})…(${r.rowEnd},${r.colEnd})`;
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
      <strong>cell</strong> ({coords.cell.rowIndex},{coords.cell.colIndex})
      {'  ·  '}<strong>ranges</strong> {coords.ranges && coords.ranges.length ? coords.ranges.map(fmt).join('  ') : '—'}
    </div>
  );
};

/**
 * Touch selection handles ({@link SelectionTouchGrips}) — round grips at the top-left and
 * bottom-right of the selection that drag to extend it (the third {@link DragHandle} flavor). Works
 * with a mouse too, so you can test it here.
 *
 * Try it: drag either round handle to grow/shrink the selection; the opposite corner stays put. You
 * can also click/drag normally (the selection layer is mounted underneath).
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const values = useMemo<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (let r = 2; r <= 8; r++) {
      for (let c = 1; c <= 5; c++) seed[cellIdentity(r, c)] = `${r},${c}`;
    }
    return seed;
  }, []);

  const selection = useMemo(() => new DefaultSelection({
    // Start with a range so the touch handles are visible immediately.
    initial: { cell: { rowIndex: 3, colIndex: 2 }, ranges: [{ rowStart: 3, colStart: 2, rowEnd: 6, colEnd: 4 }], rangeIndex: 0 },
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 })
  }), [rowCount, columnCount]);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    const value = values[cellIdentity(range!.rowStart, range!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value={value} />;
  }, [values]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <SelectionReadout selection={selection} />
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          <SelectionLayer key="selection" selection={selection} />
          <SelectionTouchGrips key="touch" selection={selection} />
        </Grid>
      </div>
    </div>
  );
};

export const Touch = asStory(Template);
Touch.args = { columnCount: 60, rowCount: 60 };
Touch.storyName = 'Touch';

const Story = {
  title: 'Selection',
  component: Touch,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
