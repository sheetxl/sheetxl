import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import { Grid, Layer, VirtualDiv } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Layer eventing — the propagation chain.
 *
 * Three overlapping {@link VirtualDiv} widgets, hosted in one {@link Layer} (they stack by DOM
 * order within it — A bottom … C top), each with `onPointerDown` / `onKeyDown`. Each is focusable
 * (`tabIndex`) with a focus ring.
 *
 * A `VirtualDiv` is a real `<div>` placed by the grid, and its events follow the **one-bubble
 * law**: the event is received at the top and then continues down the stack — there is no
 * auto-consume; `stopPropagation()` is the ONLY consume signal. Both routes are visible here:
 *
 * **Pointer** — click the **overlap**: the topmost widget hears the native event, then it continues
 * down the stack — `C, B, A`, then on to the grid. Toggle a widget's "consumes" checkbox to have
 * it `stopPropagation` and halt everything beneath it.
 *
 * **Keyboard** — click a widget to focus it (ring shows), then press a key. Keys propagate down
 * the stack the same way: the focused widget, then those below it — `C, B, A`.
 *
 * - Pointer overlap of all three → `C, B, A` (unless one consumes).
 * - Focus **C** (top) and press a key → `C, B, A`; focus **A** (bottom) → just `A` (nothing below).
 */
const WIDGETS: { id: string; range: RangeCoords; fill: string; line: string }[] = [
  { id: 'A (bottom)', range: { colStart: 1, rowStart: 1, colEnd: 6, rowEnd: 8 },   fill: 'rgba(215,0,0,0.14)',   line: 'rgb(215,0,0)' },
  { id: 'B (middle)', range: { colStart: 3, rowStart: 3, colEnd: 8, rowEnd: 10 },  fill: 'rgba(0,150,0,0.14)',   line: 'rgb(0,150,0)' },
  { id: 'C (top)',    range: { colStart: 5, rowStart: 5, colEnd: 10, rowEnd: 12 }, fill: 'rgba(0,120,215,0.14)', line: 'rgb(0,120,215)' }
];

const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [log, setLog] = useState<string[]>([]);
  const [consume, setConsume] = useState<Record<string, boolean>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);

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
      <div style={{ display: 'flex', gap: '12px', padding: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setLog([])}>Clear log</button>
        {WIDGETS.map((l) => (
          <label key={l.id} style={{ display: 'flex', gap: '4px', alignItems: 'center', color: l.line }}>
            <input
              type="checkbox"
              checked={!!consume[l.id]}
              onChange={(e) => setConsume((c) => ({ ...c, [l.id]: e.target.checked }))}
            />
            {l.id} consumes
          </label>
        ))}
        <span style={{ opacity: 0.7 }}>Click the overlap → C, B, A. Click a widget to focus, then press a key.</span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '8px', minHeight: 0 }}>
        <Grid
          {...rest}
          style={{ position: 'relative', flex: 1 }}
          renderCells={sharedCellRenderer}
          showGridLines={true}
        >
          {/* One Layer (the z-slot) hosting all three widgets — they stack by DOM order within it. */}
          <Layer>
            {WIDGETS.map((l) => (
              <VirtualDiv
                key={l.id}
                range={l.range}
                tabIndex={0}
                style={{
                  background: l.fill,
                  border: `2px solid ${l.line}`,
                  borderRadius: 6,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  padding: '4px 6px',
                  color: l.line,
                  fontWeight: 600,
                  userSelect: 'none',
                  // Focus ring (the grid suppresses the default outline), so keyboard routing is visible.
                  outline: focusedId === l.id ? `3px solid ${l.line}` : 'none',
                  outlineOffset: '2px'
                }}
                onFocus={() => setFocusedId(l.id)}
                onBlur={() => setFocusedId((cur) => (cur === l.id ? null : cur))}
                onPointerDown={(event) => {
                  append(`${l.id} ← pointer`);
                  if (consume[l.id]) event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  append(`${l.id} ← '${event.key}'`);
                  if (consume[l.id]) event.stopPropagation();
                }}
              >
                {l.id}
              </VirtualDiv>
            ))}
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
          {log.length ? log.join('\n') : '(click the overlapping boxes)'}
        </pre>
      </div>
    </div>
  );
};

export const GridLayerStacked = asStory(Template);
GridLayerStacked.args = {
  columnCount: 50,
  rowCount: 100
};

GridLayerStacked.storyName = 'Stacked Widgets (geometry)';

const Story = {
  title: 'Layers',
  component: GridLayerStacked,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
