import React, { useState, useRef } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import { Grid, Layer, VirtualDiv, type IGrid } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * The **focus model**, end to end.
 *
 * Three tiers are in play:
 * - **Surface** — the grid's Stage is itself the bottom-most focusable layer. Tab into the grid and
 *   *it* takes focus.
 * - **Widget** — an ordinary focusable {@link VirtualDiv} (`tabIndex` — a real div placed at a
 *   range) layered above the surface.
 * - **Floor** — a bottom {@link Layer} event tap: the grid-wide *observe* tier, which hears keys
 *   last (after the widgets above it), regardless of what's focused.
 *
 * **Tab** cycles `surface → widget`. A key routes to the **focused widget + the layers below it**,
 * then the floor (rule 2):
 * - **Surface** focused → nothing is below it → only the **floor** logs.
 * - **Widget** focused → `widget`, then the floor.
 * - "widget consumes" (`stopPropagation`) → only `widget`; the floor never sees it.
 *
 * Click an empty cell to focus the surface, click the card to focus the widget, or Tab between them.
 * Calling `.focus()` on the **GridSurface ref** does the same as Tab-ing in — it focuses the surface
 * (the focused/center pane's Stage), so a subsequent key routes to the floor only.
 */
const WIDGET_RANGE: RangeCoords = { colStart: 3, rowStart: 3, colEnd: 8, rowEnd: 7 };

const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [log, setLog] = useState<string[]>([]);
  const [widgetFocused, setWidgetFocused] = useState<boolean>(false);
  const [consume, setConsume] = useState<boolean>(false);

  const gridRef = useRef<IGrid>(null);

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
        <button onClick={() => gridRef.current?.focus()}>grid.focus() → surface</button>
        <label style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input type="checkbox" checked={consume} onChange={(e) => setConsume(e.target.checked)} />
          widget consumes (stopPropagation)
        </label>
        <span style={{ opacity: 0.7 }}>
          Tab into the grid (<strong>surface</strong>), Tab again (<strong>widget</strong>), then press a key.
        </span>
        <span style={{ fontFamily: 'monospace' }}>
          focus: <strong>{widgetFocused ? 'widget' : 'surface (grid)'}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '8px', minHeight: 0 }}>
        <Grid
          ref={gridRef}
          {...rest}
          style={{ position: 'relative', flex: 1 }}
          renderCells={sharedCellRenderer}
          showGridLines={true}
        >
          {/* The floor: a grid-wide observe-tier tap (a non-visual Layer). No element, no position —
              it hears keys after the widgets above it, whatever is focused. */}
          <Layer onKeyDown={() => append("floor (Layer tap) ← key")} />

          {/* A focusable widget — an ordinary VirtualDiv with tabIndex, hosted in its own Layer.
              Its keydown bubbles on down the stack unless it calls stopPropagation (the one
              consume signal — toggled by the checkbox). */}
          <Layer>
            <VirtualDiv
              range={WIDGET_RANGE}
              tabIndex={0}
              style={{
                background: 'rgba(0,120,215,0.12)',
                border: '2px solid rgb(0,120,215)',
                borderRadius: 6,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgb(0,90,170)',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                // Focus ring (the grid suppresses the default outline).
                outline: widgetFocused ? '3px solid rgb(0,120,215)' : 'none',
                outlineOffset: '2px'
              }}
              onFocus={() => setWidgetFocused(true)}
              onBlur={() => setWidgetFocused(false)}
              onKeyDown={(event) => {
                append("widget (VirtualDiv) ← key");
                if (consume) event.stopPropagation();
              }}
            >
              Focusable widget
            </VirtualDiv>
          </Layer>
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
          {log.length ? log.join('\n') : '(Tab in, then press a key)'}
        </pre>
      </div>
    </div>
  );
};

export const GridLayerFocus = asStory(Template);
GridLayerFocus.args = {
  columnCount: 50,
  rowCount: 100
};

GridLayerFocus.storyName = 'Focus (surface vs widget)';

const Story = {
  title: 'Layers',
  component: GridLayerFocus,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
