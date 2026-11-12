import React, { useCallback, useMemo, useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Layer, DragHandle, RangeRect, DefaultCellRenderer,
  type CellRendererProps, type DragHandleRenderProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

const GREEN = 'rgb(33, 115, 70)';
const BLUE = 'rgb(26, 115, 232)';

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

/**
 * The Excel table-resize **tick**: the top-left arms of a cross meeting on the corner divider (a
 * short stroke up + a short stroke left from the box centre, which sits on the range's BR corner).
 */
const tableTick = ({ handleProps, size, background }: DragHandleRenderProps): React.ReactNode => {
  const gap = 2.5;          // small visual gap so the tick sits just off the divider, not on it
  const c = size / 2 - gap; // the corner point, nudged up-left off the BR divider (box centre is size/2)
  const arm = size / 3;   // arm length (shorten by pulling the far ends in, not by moving the corner)
  return (
    <div {...handleProps} style={{ ...handleProps.style, width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
        <path
          shapeRendering='crispEdges'
          d={`M ${c - arm} ${c} L ${c} ${c} L ${c} ${c - arm}`}
          stroke={background}
          strokeWidth={2}
          strokeLinejoin="miter"
          fill="none"
        />
      </svg>
    </div>
  );
};

/**
 * Showcases {@link DragHandle}'s `renderHandle` — a configurable handle visual. Here it draws the
 * little Excel **table-resize tick** at the bottom-right of a "table"; drag it to grow/shrink the
 * table's bottom-right corner. `renderHandle` replaces the default square dot while `DragHandle`
 * keeps the placement, pointer-capture, and cell hit-testing.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const [table, setTable] = useState<RangeCoords>({ rowStart: 3, colStart: 2, rowEnd: 7, colEnd: 5 });

  const values = useMemo<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (let r = 3; r <= 12; r++) {
      for (let c = 2; c <= 8; c++) seed[cellIdentity(r, c)] = `${r},${c}`;
    }
    return seed;
  }, []);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    const value = values[cellIdentity(range!.rowStart, range!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value={value} />;
  }, [values]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          <strong>table</strong> ({table.rowStart},{table.colStart})…({table.rowEnd},{table.colEnd})
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          {/* One Layer for the table feature: the outline + its resize tick travel together. */}
          <Layer key="table">
            <RangeRect key="outline" range={table} stroke={GREEN} alignWidth={1} />
            <DragHandle
              key="tick"
              range={table}
              anchor="br"
              size={12}
              background={BLUE}
              renderHandle={tableTick}
              onDragMove={(_from, to) => setTable((prev) => ({
                ...prev,
                rowEnd: Math.max(prev.rowStart, to.rowIndex),
                colEnd: Math.max(prev.colStart, to.colIndex)
              }))}
            />
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const DragHandleTick = asStory(Template);
DragHandleTick.args = {
  columnCount: 60,
  rowCount: 60
};

DragHandleTick.storyName = 'DragHandle (custom handle))';

const Story = {
  title: 'Layers',
  component: DragHandleTick,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
