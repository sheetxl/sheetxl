import React, { useCallback, useRef, useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Layer, Draggable, RangeRect, DefaultCellRenderer,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  /** 'entire' = grab anywhere on the rectangle (default); 'edges' = grab only the border. */
  grip: 'entire' | 'edges';
}

const INITIAL_RANGE: RangeCoords = { rowStart: 3, colStart: 2, rowEnd: 6, colEnd: 4 };

/** Move the block of values from `from` to the same-size `to` (cut-move). */
const relocate = (
  prev: Record<string, string>,
  from: RangeCoords,
  to: RangeCoords
): Record<string, string> => {
  const dR = to.rowStart - from.rowStart;
  const dC = to.colStart - from.colStart;
  const next = { ...prev };
  const moved: Record<string, string> = {};
  for (let r = from.rowStart; r <= from.rowEnd; r++) {
    for (let c = from.colStart; c <= from.colEnd; c++) {
      const k = cellIdentity(r, c);
      if (k in next) {
        moved[cellIdentity(r + dR, c + dC)] = next[k];
        delete next[k];
      }
    }
  }
  return { ...next, ...moved };
};

/**
 * `Draggable` makes **any** content draggable. Here it wraps a single `RangeRect` outline — drag the
 * rectangle to translate it; the outline follows the pointer **live** (we wire `onDragMove → setRange`),
 * and the values relocate on release (cut-move). `Draggable` itself draws nothing — the outline is the
 * composed child. `grip: 'entire'` (default) grabs anywhere; `'edges'` only the border.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, grip, ...rest } = props;

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
  // Live `onDragMove` overwrites `range`, so capture the drag's origin for the cut-move's `from`.
  const moveFromRef = useRef<RangeCoords | null>(null);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range: cellRange, ...cellRest } = cellProps;
    const value = values[cellIdentity(cellRange!.rowStart, cellRange!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={cellRange} value={value} />;
  }, [values]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          <strong>range</strong> ({range.rowStart},{range.colStart})…({range.rowEnd},{range.colEnd})
          {'  ·  '}<strong>grip</strong> {grip}
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          {/* One Layer for the movable feature (law 4: grid children are Layers). */}
          <Layer key="move">
            <Draggable
              range={range}
              grip={grip}
              onDragStart={(r) => { moveFromRef.current = r; }}
              onDragMove={(to) => setRange(to)}
              onDragEnd={(to) => {
                const from = moveFromRef.current ?? range;
                moveFromRef.current = null;
                setValues((prev) => relocate(prev, from, to));
                setRange(to);
              }}
            >
              <RangeRect range={range} stroke="rgb(33, 115, 70)" alignWidth={2} fill="rgba(16, 124, 65, 0.10)" />
            </Draggable>
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const Movable = asStory(Template);
Movable.args = { columnCount: 60, rowCount: 60, grip: 'entire' };
Movable.storyName = 'Movable range';

const Story = {
  title: 'Layers',
  component: Movable,
  argTypes: {
    grip: { control: { type: 'inline-radio' }, options: ['edges', 'entire'] }
  },
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
