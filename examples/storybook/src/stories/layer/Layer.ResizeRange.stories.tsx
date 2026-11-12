import React, { useCallback, useMemo, useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Layer, RangeResizer, DefaultCellRenderer,
  RESIZE_ANCHORS_4, RESIZE_ANCHORS_8,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  /** 4 = corners only (chart series / precedents); 8 = corners + edge midpoints. */
  handles: 4 | 8;
}

/**
 * The `RangeResizer` primitive standalone (no selection) — a resizable range rectangle with grips,
 * built from the generic {@link DragHandle}. Use the **handles** control to switch between modes:
 *
 * - **4** — corners only. The chart-series / formula-precedent re-scope (each corner moves two edges).
 * - **8** — adds the edge midpoints, i.e. ordinary single-edge box resize (like an image/shape). Same
 *   primitive, just more grips — shown here to prove the flavor generalizes.
 *
 * Drag any grip to re-scope; dragging past the opposite edge flips the rectangle (forced to 1x1 at the
 * crossover, like Excel).
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, handles, ...rest } = props;

  // A few labeled cells so the resize is easy to read against the grid.
  const values = useMemo<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (let r = 2; r <= 8; r++) {
      for (let c = 2; c <= 6; c++) seed[cellIdentity(r, c)] = `${r},${c}`;
    }
    return seed;
  }, []);

  const [range, setRange] = useState<RangeCoords>({ rowStart: 3, colStart: 3, rowEnd: 7, colEnd: 5 });

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range: cellRange, ...cellRest } = cellProps;
    const value = values[cellIdentity(cellRange!.rowStart, cellRange!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={cellRange} value={value} />;
  }, [values]);

  const anchors = handles === 4 ? RESIZE_ANCHORS_4 : RESIZE_ANCHORS_8;

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          <strong>range</strong> ({range.rowStart},{range.colStart})…({range.rowEnd},{range.colEnd})
          {'  ·  '}<strong>handles</strong> {handles}
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          {/* One Layer hosting the resize feature (law 4: grid children are Layers). */}
          <Layer key="resize">
            <RangeResizer range={range} anchors={anchors} onDragEnd={setRange} />
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const ResizeRange = asStory(Template);
ResizeRange.args = { columnCount: 60, rowCount: 60, handles: 8 };
ResizeRange.storyName = 'Resize range';

const Story = {
  title: 'Layers',
  component: ResizeRange,
  argTypes: {
    handles: { control: { type: 'inline-radio' }, options: [4, 8] }
  },
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
