import React, { useRef, useState } from 'react';

import { Grid, Layer } from '@sheetxl/grid-react';

import { sharedCellRenderer, asStory } from '../../components';

/**
 * **Pointer capture is native** (Layer eventing — drag case).
 *
 * Because a widget over the grid is just a plain `<div>`, a drag uses the browser's own
 * `setPointerCapture` — **no framework support needed**. On `pointerdown` the widget captures the
 * pointer; the browser then routes every `pointermove`/`pointerup` to it even when the pointer
 * leaves the widget or the grid. The widget `stopPropagation`s (the one consume signal) so the drag
 * doesn't also continue down the stack to the grid-wide tap.
 *
 * - **Capture on** (default): drag fast / off the box / off the grid — the box stays glued.
 * - **Capture off**: the box's `onPointerMove` only fires while the pointer is over it, so a quick
 *   drag "outruns" the box and it freezes until the pointer catches back up. That gap is exactly
 *   what `setPointerCapture` closes.
 * - The grid-wide counter does **not** increment when you grab the box (it consumes via
 *   `stopPropagation`), but does on a bare-grid click.
 */
const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [pos, setPos] = useState({ x: 160, y: 140 });
  const [dragging, setDragging] = useState(false);
  const [useCapture, setUseCapture] = useState(true);
  const [gridClicks, setGridClicks] = useState(0);

  const refDrag = useRef<{ cx: number; cy: number; x: number; y: number } | null>(null);

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
        <label style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input type="checkbox" checked={useCapture} onChange={(e) => setUseCapture(e.target.checked)} />
          use pointer capture
        </label>
        <span style={{ opacity: 0.7 }}>
          Drag the box (try fast / off-grid). grid-wide clicks: {gridClicks} · {dragging ? 'dragging' : 'idle'}
        </span>
      </div>

      <Grid
        {...rest}
        style={{ position: 'relative', flex: 1 }}
        renderCells={sharedCellRenderer}
        showGridLines={true}
      >
        {/* grid-wide tap (a non-visual Layer) — should NOT fire while grabbing the box (it consumes) */}
        <Layer onPointerDown={() => setGridClicks((c) => c + 1)} />

        {/* draggable widget — a plain div using native setPointerCapture, hosted in its own Layer
            (law 4: grid children are Layers) */}
        <Layer>
          <div
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: 150,
              height: 110,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: dragging ? 'rgba(16,124,16,0.18)' : 'rgba(0,120,215,0.14)',
              border: `2px solid ${dragging ? 'rgb(16,124,16)' : 'rgb(0,120,215)'}`,
              borderRadius: 6,
              boxSizing: 'border-box',
              cursor: dragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none'
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (useCapture) event.currentTarget.setPointerCapture(event.pointerId);
              refDrag.current = { cx: event.clientX, cy: event.clientY, x: pos.x, y: pos.y };
              setDragging(true);
            }}
            onPointerMove={(event) => {
              const d = refDrag.current;
              if (!d) return;
              event.stopPropagation();
              setPos({ x: d.x + (event.clientX - d.cx), y: d.y + (event.clientY - d.cy) });
            }}
            onPointerUp={(event) => {
              if (!refDrag.current) return;
              event.stopPropagation();
              if (useCapture) {
                try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
              }
              refDrag.current = null;
              setDragging(false);
            }}
          >
            drag me
          </div>
        </Layer>
      </Grid>
    </div>
  );
};

export const LayerDragCapture = asStory(Template);
LayerDragCapture.args = {
  columnCount: 50,
  rowCount: 100
};

LayerDragCapture.storyName = 'Drag Capture';

const Story = {
  title: 'Layers',
  component: LayerDragCapture,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
