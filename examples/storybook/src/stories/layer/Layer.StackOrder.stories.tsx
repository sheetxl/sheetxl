import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import { Grid, Layer, RangeRect } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Demonstrates `zIndex` as the **ordering knob** on a {@link Layer}. z belongs to Layers — the
 * grid sorts its direct children by `zIndex` (ties keep declaration order) into a flat stack, and
 * the resulting **slot orders both axes**: painting (a higher slot's visuals draw on top) and event
 * dispatch (a higher slot's tap is offered events first). One number, both axes — paint order and
 * dispatch order can never disagree.
 *
 * Each band here is one `<Layer zIndex={n}>` — a DIRECT grid child (Layers are never nested) —
 * holding its `RangeRect` visual, with the band's key handlers directly on the Layer (the tap).
 * `C` and `D` declare `zIndex={1}` but are declared **first**; `A` and `B` sit at the default
 * `z = 0` and are declared after. The explicit z overrides declaration order:
 *
 * - **Paint** — where the bands overlap, the z=1 fills (C/D) draw ON TOP of the z=0 fills (A/B),
 *   even though A/B were declared later.
 * - **Dispatch** — click the grid to focus it, then press a key: top-of-z first, and within each
 *   equal-z group the later-declared layer (which paints on top) goes first. Expected order:
 *   **D, C, B, A**. Nothing calls `stopPropagation` (the one consume signal), so the key falls
 *   through the whole stack.
 */
interface Band { id: string; z: number; range: RangeCoords; stroke: string; fill: string; }

const BANDS: Band[] = [
  // Declared FIRST but lifted to z=1 — they paint on top of (and hear before) A/B.
  { id: 'C (z=1, declared 1st)', z: 1, range: { colStart: 3, rowStart: 3, colEnd: 8, rowEnd: 7 },  stroke: 'rgb(0,120,215)', fill: 'rgba(0,120,215,0.25)' },
  { id: 'D (z=1, declared 2nd)', z: 1, range: { colStart: 5, rowStart: 5, colEnd: 10, rowEnd: 9 }, stroke: 'rgb(136,23,152)', fill: 'rgba(136,23,152,0.25)' },
  // Declared LAST at the default z=0 — the explicit z above still wins.
  { id: 'A (z=0, declared 3rd)', z: 0, range: { colStart: 1, rowStart: 1, colEnd: 6, rowEnd: 5 },  stroke: 'rgb(215,0,0)',   fill: 'rgba(215,0,0,0.25)' },
  { id: 'B (z=0, declared 4th)', z: 0, range: { colStart: 2, rowStart: 2, colEnd: 7, rowEnd: 6 },  stroke: 'rgb(0,150,0)',   fill: 'rgba(0,150,0,0.25)' }
];

const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [log, setLog] = useState<string[]>([]);
  const append = (id: string) => setLog((prev) => [...prev, id]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', gap: '12px', padding: '8px', alignItems: 'center' }}>
        <button onClick={() => setLog([])}>Clear log</button>
        <span style={{ opacity: 0.7 }}>
          C/D declare z=1 (though declared first) so they paint above A/B. Click the grid, then
          press a key — dispatch is top-of-z first → expected D, C, B, A.
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '8px', minHeight: 0 }}>
        <Grid
          {...rest}
          style={{ position: 'relative', flex: 1 }}
          renderCells={sharedCellRenderer}
          showGridLines={true}
        >
          {/* One Layer per band: the z-slot (zIndex), the visual (RangeRect), and the tap
              (onKeyDown) travel together. All are DIRECT grid children — the stack is flat. */}
          {BANDS.map((b) => (
            <Layer key={b.id} zIndex={b.z} onKeyDown={(e) => append(`${b.id} ← '${e.key}'`)}>
              <RangeRect range={b.range} alignWidth={2} stroke={b.stroke} fill={b.fill} />
            </Layer>
          ))}
        </Grid>

        <pre
          style={{
            width: 300,
            margin: 0,
            padding: 8,
            overflow: 'auto',
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.1)',
            fontSize: 12,
            lineHeight: 1.5
          }}
        >
          {log.length ? log.join('\n') : '(press a key over the focused grid)'}
        </pre>
      </div>
    </div>
  );
};

export const LayerStackOrder = asStory(Template);
LayerStackOrder.args = {
  columnCount: 50,
  rowCount: 100
};

LayerStackOrder.storyName = 'Stack Order (z override)';

const Story = {
  title: 'Layers',
  component: LayerStackOrder,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
