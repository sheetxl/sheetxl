import React, { useState } from 'react';

import { Grid, Layer } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * The **one-bubble law** — the single rule for how a widget and the grid share an event.
 *
 * A widget over the grid is just an ordinary React element: a plain `<div onPointerDown=…>`. No
 * registration, no flag. A click on the widget fires its handler natively (it's on top), then the
 * event continues down the layer stack to the grid-wide taps below (here, a non-visual `Layer`
 * tap). There is **no auto-consume**: `event.stopPropagation()` is the ONLY consume signal — a
 * widget that should BLOCK the grid calls it; one that shouldn't simply doesn't.
 *
 * - Click the **blue widget** (does NOT stop propagation): logs `widget` first (native, topmost),
 *   then the event bubbles on → logs `grid-wide`. The grid still reacts underneath.
 * - Click the **green widget** (calls `stopPropagation`): only `widget` — the grid is blocked.
 * - Click the **bare grid**: only `grid-wide` (no widget is under the point).
 */
const WIDGET_BASE: React.CSSProperties = {
  position: 'absolute', width: 200, height: 130,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, boxSizing: 'border-box', cursor: 'pointer', userSelect: 'none',
  textAlign: 'center', gap: 4
};

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
          Click each widget: blue bubbles on to the grid; green consumes (stopPropagation).
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '8px', minHeight: 0 }}>
        <Grid
          {...rest}
          style={{ position: 'relative', flex: 1 }}
          renderCells={sharedCellRenderer}
          showGridLines={true}
        >
          {/* grid-wide tap — a non-visual Layer (z-slot + event tap), heard whatever is under the
              pointer, after everything above it in the stack */}
          <Layer onPointerDown={() => append('grid-wide (Layer tap)')} />

          {/* the widgets — normal React divs with native handlers, hosted in one Layer */}
          <Layer>
            {/* bubbles: no stopPropagation → the grid still reacts underneath */}
            <div
              style={{
                ...WIDGET_BASE, left: 120, top: 140,
                background: 'rgba(0,120,215,0.12)', border: '2px solid rgb(0,120,215)'
              }}
              onPointerDown={() => append('widget (bubbles)')}
            >
              <b>bubbles</b>
              <span style={{ fontSize: 12, opacity: 0.75 }}>no stopPropagation —<br />the grid hears it too</span>
            </div>
            {/* consumes: stopPropagation → the grid is blocked */}
            <div
              style={{
                ...WIDGET_BASE, left: 380, top: 140,
                background: 'rgba(16,124,16,0.12)', border: '2px solid rgb(16,124,16)'
              }}
              onPointerDown={(event) => {
                append('widget (consumes)');
                event.stopPropagation();
              }}
            >
              <b>consumes</b>
              <span style={{ fontSize: 12, opacity: 0.75 }}>stopPropagation —<br />the grid is blocked</span>
            </div>
          </Layer>
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
          {log.length ? log.join('\n') : '(click a widget / the grid)'}
        </pre>
      </div>
    </div>
  );
};

// Export name kept for story-URL stability (the old name predates the one-bubble redesign).
export const GridLayerWidgetPassthrough = asStory(Template);
GridLayerWidgetPassthrough.args = {
  columnCount: 50,
  rowCount: 100
};

GridLayerWidgetPassthrough.storyName = 'Widget (one-bubble law)';

const Story = {
  title: 'Layers',
  component: GridLayerWidgetPassthrough,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
