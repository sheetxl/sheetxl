import React, { useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import { Grid, Layer, VirtualDiv } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Demonstrates {@link VirtualDiv} as a generic placement host: drop ARBITRARY HTML
 * content at a range and it is virtually bound to the grid — it scrolls with the cells,
 * culls when scrolled off-screen, and its box edges device-snap so it lines up with the
 * gridlines.
 *
 * `VirtualDiv` IS a regular `<div>` whose bounds the grid drives — use it like any div,
 * placed at a range (inside a `Layer`, the grid child that gives it a z-slot):
 * ```tsx
 * <Layer>
 *   <VirtualDiv range={range} style={…}>…any content / text / a button…</VirtualDiv>
 * </Layer>
 * ```
 * Use the buttons to toggle the widget and move it between ranges, then scroll to see it
 * stay bound and cull.
 */
const POSITIONS: RangeCoords[] = [
  { colStart: 1, rowStart: 1, colEnd: 3, rowEnd: 3 },
  { colStart: 5, rowStart: 6, colEnd: 8, rowEnd: 9 },
  { colStart: 2, rowStart: 12, colEnd: 4, rowEnd: 14 },
  { colStart: 10, rowStart: 20, colEnd: 13, rowEnd: 24 }
];

const Template: React.FC = (props) => {
  const { ...rest } = props as any;

  const [visible, setVisible] = useState<boolean>(true);
  const [posIndex, setPosIndex] = useState<number>(0);
  const [clicks, setClicks] = useState<number>(0);

  const range = POSITIONS[posIndex];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
    >
      <div style={{ display: "flex", gap: "8px", padding: "8px", alignItems: "center" }}>
        <button onClick={() => setVisible((v) => !v)}>
          {visible ? "Hide" : "Show"} widget
        </button>
        <button onClick={() => setPosIndex((i) => (i + 1) % POSITIONS.length)}>
          Move widget
        </button>
        <span style={{ opacity: 0.7 }}>
          range: [{range.colStart},{range.rowStart}]–[{range.colEnd},{range.rowEnd}] ·
          inner-button clicks: {clicks}
        </span>
      </div>

      <Grid
        {...rest}
        style={{
          position: "relative",
          flex: "1"
        }}
        renderCells={sharedCellRenderer}
        showGridLines={true}
      >
        {/* One Layer (the z-slot) hosting both placed boxes. */}
        <Layer>
          {/* A CSS-background box placed at a range (like a cell fill) — content that
              can't be an SVG fill. A pure decoration, so it opts out of hit-testing
              (pointerEvents: 'none' — a VirtualDiv is hittable by default, like any div). */}
          <VirtualDiv
            range={{ colStart: 6, rowStart: 1, colEnd: 9, rowEnd: 3 }}
            coverGridlines
            style={{
              background: "linear-gradient(135deg, rgba(0,120,215,0.25), rgba(16,124,16,0.25))",
              pointerEvents: "none"
            }}
          />

          {/* An interactive widget placed at a range — VirtualDiv used like a regular
              div: arbitrary HTML / text directly inside, plus a working button. Its
              pointerdown stops propagation (the one consume signal) so interacting with
              the card doesn't also reach the grid beneath. */}
          {visible ? (
            <VirtualDiv
              range={range}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255,255,255,0.96)",
                border: "2px solid rgb(0,120,215)",
                borderRadius: "6px",
                boxShadow: "0px 2px 6px 1px var(--sxl-color-shadow, rgba(0, 0, 0, 0.3))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                overflow: "hidden"
              }}
            >
              Custom Widget
              <button onClick={() => setClicks((c) => c + 1)}>click me</button>
            </VirtualDiv>
          ) : null}
        </Layer>
      </Grid>
    </div>
  );
};

export const GridWithWidgetDiv = asStory(Template);
GridWithWidgetDiv.args = {
  columnCount: 50,
  rowCount: 100
};

GridWithWidgetDiv.storyName = "Widget (host content)";

const Story = {
  title: 'Layers',
  component: GridWithWidgetDiv,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
