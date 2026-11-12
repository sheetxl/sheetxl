import React, { useCallback, useMemo } from 'react';

import { type RangeCoords, type SelectionCoords } from '@sheetxl/utils'
import { useBoundSyncExternalStore } from '@sheetxl/utils-react';

import {
  Grid, RangesPickerLayer, DefaultSelection, DefaultCellRenderer,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  /** How many range rectangles to show, each offset by one cell and cycled to the next palette color. */
  pickerCount: number;
  /** Which range is "active" — the one an empty-grid drag (re)draws and the one that animates. */
  pickerIndex: number;
}

/** A live readout of the model's coords. */
const CoordsReadout: React.FC<{ selection: DefaultSelection }> = ({ selection }) => {
  const coords = useBoundSyncExternalStore(selection, (s) => s.getSelection());
  const active = coords.ranges?.[coords.rangeIndex ?? -1];
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
      <strong>active</strong>{' '}
      {active ? `(${active.rowStart},${active.colStart})…(${active.rowEnd},${active.colEnd})` : '—'}
    </div>
  );
};

/**
 * A **multi-rectangle** range picker — the control used to re-scope a formula's references or a chart's
 * data ranges (`RangesPickerLayer`). Like `SelectionLayer` it binds to a **selection model**
 * (`ISelection`, here a `DefaultSelection`) and writes every gesture straight back through it. Each
 * rectangle is independently resizable/movable and gets its own color (cycled through
 * {@link PICKER_COLORS}); only the **active** range animates (marching-ants) and is what an empty-grid
 * drag re-scopes.
 *
 * Try it:
 * - **Drag empty grid** to (re)draw the **active** rectangle (the others stay put).
 * - Drag a **corner** to resize (4 corners by default; past the opposite corner flips, Excel-style).
 * - Hover a **border** — it thickens (2→3px) — then drag it to move (same size). `grabbing` mid-drag.
 * - Interacting with a rectangle makes it the **active** one.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, pickerCount, pickerIndex, ...rest } = props;

  // The selection model the picker binds to — re-seeded when the args change.
  const selection = useMemo(() => {
    const count = Math.max(1, pickerCount);
    const ranges: RangeCoords[] = Array.from(
      { length: count },
      (_, i) => ({ rowStart: 3 + i, colStart: 2 + i, rowEnd: 7 + i, colEnd: 5 + i })
    );
    const active = Math.min(Math.max(0, pickerIndex), count - 1);
    const initial: SelectionCoords = {
      cell: { rowIndex: ranges[active].rowStart, colIndex: ranges[active].colStart },
      ranges,
      rangeIndex: active
    };
    return new DefaultSelection({ initial });
  }, [pickerCount, pickerIndex]);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value="" />;
  }, []);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <CoordsReadout selection={selection} />
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          <RangesPickerLayer
            selection={selection}
            enabledMove
            animated
          />
        </Grid>
      </div>
    </div>
  );
};

export const Range = asStory(Template);
Range.args = {
  columnCount: 200,
  rowCount: 200,
  pickerCount: 3,
  pickerIndex: 0
};

Range.storyName = 'Picker';

const Story = {
  title: 'Selection',
  component: Range,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
