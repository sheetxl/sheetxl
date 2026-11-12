import React, { useCallback, useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Layer, FillHandle, DefaultCellRenderer, RangeRect,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

const INITIAL_RANGE: RangeCoords = { rowStart: 2, colStart: 2, rowEnd: 4, colEnd: 2 };

/**
 * The `FillHandle` primitive standalone (no selection) — drag the fill square at the bottom-right corner
 * to extend the range along one axis (Excel-style), carrying the template values into the new cells.
 * `FillHandle` reports the destination range via `onDragEnd`; the story owns the controlled `range` and
 * the data fill. (Inside a `SelectionLayer`, set `enableFill` instead — it wires this up for you.)
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const [range, setRange] = useState<RangeCoords>(INITIAL_RANGE);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (let r = INITIAL_RANGE.rowStart; r <= INITIAL_RANGE.rowEnd; r++) {
      for (let c = INITIAL_RANGE.colStart; c <= INITIAL_RANGE.colEnd; c++) {
        seed[cellIdentity(r, c)] = `${r},${c}`;
      }
    }
    return seed;
  });

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range: cellRange, ...cellRest } = cellProps;
    const value = values[cellIdentity(cellRange!.rowStart, cellRange!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={cellRange} value={value} />;
  }, [values]);

  // Fill the destination from the template (the current `range`), repeating each column's template value
  // down/across, then extend the range to the destination.
  const handleFill = useCallback((destination: RangeCoords) => {
    setValues((prev) => {
      const next = { ...prev };
      for (let r = destination.rowStart; r <= destination.rowEnd; r++) {
        for (let c = destination.colStart; c <= destination.colEnd; c++) {
          const srcR = Math.min(Math.max(r, range.rowStart), range.rowEnd);
          const srcC = Math.min(Math.max(c, range.colStart), range.colEnd);
          next[cellIdentity(r, c)] = prev[cellIdentity(srcR, srcC)] ?? '';
        }
      }
      return next;
    });
    setRange(destination);
  }, [range]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          <strong>range</strong> ({range.rowStart},{range.colStart})…({range.rowEnd},{range.colEnd})
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          {/* One Layer for the fill feature: outline + fill handle travel together. */}
          <Layer key="fill-feature">
            {/* The range outline. FillHandle itself only draws the corner handle + a drag preview, so
                we draw the range here. NOTE: `stroke`/`alignWidth` are top-level props — NOT `style`,
                which is the <svg> element's CSS and does not drive the path stroke. */}
            <RangeRect key="range" range={range} stroke="rgb(0, 120, 215)" alignWidth={2} />
            {/* Demo: a custom stroke recolors the fill handle (the square) + the drag preview — the
                component default is green; this prop doesn't change it. */}
            <FillHandle key="fill" range={range} stroke="rgb(0, 120, 215)" onDragEnd={handleFill} />
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const Fill = asStory(Template);
Fill.args = { columnCount: 60, rowCount: 60 };
Fill.storyName = 'Fill range';

const Story = {
  title: 'Layers',
  component: Fill,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
