import React, { useState } from 'react';

import { Grid, Layer } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Demonstrates the Stage **dispatch order** across the layer stack.
 *
 * Several non-visual {@link Layer}s — each just a z-slot + a grid-wide event tap — render as
 * DIRECT grid children in array order (A first … D last; sibling Layers are never nested). Click
 * the grid to focus it, then press any key: dispatch is **top-of-z first** — the last-declared
 * layer sits highest in the stack (declaration order IS the z order when no `zIndex` is given), so
 * its tap is offered the event first, then down the stack. This mirrors a click on a stacked
 * widget (the widget on top is offered the event before the layers beneath it — see the `Widget`
 * story). Nothing calls `stopPropagation` — the one consume signal — so every layer receives it
 * (fall-through). Expected order: **D, C, B, A**.
 *
 * Regression guard for "dispatch is top-of-z first (reverse declaration order)", the same ordering
 * the paint stack uses — one slot, both axes.
 */
const LAYERS: string[] = [
  'A (declared 1st)',
  'B (declared 2nd)',
  'C (declared 3rd)',
  'D (declared 4th)'
];

const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [log, setLog] = useState<string[]>([]);

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
      <div style={{ display: 'flex', gap: '8px', padding: '8px', alignItems: 'center' }}>
        <button onClick={() => setLog([])}>Clear log</button>
        <span style={{ opacity: 0.7 }}>
          Click the grid to focus it, then press a key. Expected dispatch order: D, C, B, A.
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '8px', minHeight: 0 }}>
        <Grid
          {...rest}
          style={{
            position: 'relative',
            flex: 1
          }}
          renderCells={sharedCellRenderer}
          showGridLines={true}
        >
          {LAYERS.map((id) => (
            <Layer
              key={id}
              onKeyDown={(event) => {
                setLog((prev) => [...prev, `${id} ← '${event.key}'`]);
              }}
            />
          ))}
        </Grid>

        <pre
          style={{
            width: 280,
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

export const GridLayerDispatchOrder = asStory(Template);
GridLayerDispatchOrder.args = {
  columnCount: 50,
  rowCount: 100
};

GridLayerDispatchOrder.storyName = 'Dispatch Order';

const Story = {
  title: 'Layers',
  component: GridLayerDispatchOrder,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
