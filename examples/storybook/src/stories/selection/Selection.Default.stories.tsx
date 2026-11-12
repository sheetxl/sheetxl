import React, { useCallback, useMemo, useState } from 'react';

import { type SelectionCoords, type RangeCoords } from '@sheetxl/utils';
import { useBoundSyncExternalStore } from '@sheetxl/utils-react';

import {
  Grid, SelectionLayer, DefaultSelection, DefaultCellRenderer,
  type CellRendererProps, type ISelection
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

/** A live readout of the current {@link ISelection} — handy for eyeballing pointer/keyboard behavior. */
const SelectionReadout: React.FC<{ selection: ISelection }> = ({ selection }) => {
  const coords: SelectionCoords = useBoundSyncExternalStore(selection, (s) => s.getSelection());
  const fmt = (r: RangeCoords): string => `(${r.rowStart},${r.colStart})…(${r.rowEnd},${r.colEnd})`;
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <strong>cell</strong> ({coords.cell.rowIndex},{coords.cell.colIndex})
      {'  ·  '}<strong>ranges</strong> {coords.ranges && coords.ranges.length ? coords.ranges.map(fmt).join('  ') : '—'}
      {'  ·  '}<strong>active</strong> {coords.rangeIndex}
    </div>
  );
};

/**
 * The default selection: `SelectionLayer` with the built-in **move grip** (drag the border to move)
 * and the built-in **fill handle** (`enableFill` — drag the bottom-right square to fill). Plus a live
 * `SelectionCoords` readout. Column A is pre-seeded so the fill is visible.
 *
 * Try it:
 * - **Click** / **drag** to select; **Shift+click** / **Shift+drag** extends from the anchor.
 * - **Ctrl/Cmd+click** / **drag** adds a range; **Ctrl/Cmd+drag** over a selected area removes it.
 * - **Arrows** move; **Shift+Arrow** extends; **Enter/Tab** (Shift = reverse) traverse.
 * - Drag the **selection border** to move the (single) range; drag the **fill square** to fill.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 })
  }), [rowCount, columnCount]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (let r = 0; r < 5; r++) seed[cellIdentity(r, 0)] = `r${r}`;
    return seed;
  });

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    const value = values[cellIdentity(range!.rowStart, range!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value={value} />;
  }, [values]);

  // The fill data side-effect: repeat the template's per-column value across the destination.
  const handleFill = useCallback((template: RangeCoords, destination: RangeCoords) => {
    setValues((prev) => {
      const next = { ...prev };
      for (let r = destination.rowStart; r <= destination.rowEnd; r++) {
        for (let c = destination.colStart; c <= destination.colEnd; c++) {
          const srcR = Math.min(Math.max(r, template.rowStart), template.rowEnd);
          const srcC = Math.min(Math.max(c, template.colStart), template.colEnd);
          next[cellIdentity(r, c)] = prev[cellIdentity(srcR, srcC)] ?? '';
        }
      }
      return next;
    });
  }, []);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <SelectionReadout selection={selection} />
        <Grid
          {...rest}
          freezeLeft={2}
          freezeTop={3}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          <SelectionLayer
            key="selection"
            selection={selection}
            enabledMove
            enableFill
            onFill={handleFill}
          />
        </Grid>
      </div>
    </div>
  );
};

export const Default = asStory(Template);
Default.args = {
  columnCount: 200,
  rowCount: 200
};

Default.storyName = 'Default';

const Story = {
  title: 'Selection',
  component: Default,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
