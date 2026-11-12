import React from 'react';

import { Grid, Layer, RangeRect } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Alignment harness for `RangeRect` (step 3 of the layer-primitives plan).
 *
 * The visual contract to verify — at **dpr 1 / 1.5 / 2** (use browser zoom or drag the
 * window to a 2x monitor) and at grid **zoom**:
 * - A **1px** `RangeRect` outline sits EXACTLY on the gridlines bounding its range
 *   (both go through the same `edgeCenter` rule → identical device pixels).
 * - **2px** (even) grows outward: leading (top/left) before the divider, trailing
 *   (bottom/right) after it.
 * - **3px** (odd) is centered: one device px on each side of the divider.
 * - Every width stays a crisp, constant whole number of device px (no blur/shimmer).
 * - Disjoint ranges render independently (no merging).
 * - Fill butts the stroke on all four sides (no `-1,-1` asymmetry).
 */
const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        renderCells={sharedCellRenderer}
        showGridLines={true}
      >
        {/* One Layer (the z-slot) holding all the decorations — RangeRects are pure visuals. */}
        <Layer>
          {/* 1px — should land exactly on the gridlines at this range's edges */}
          <RangeRect
            range={{ colStart: 1, rowStart: 1, colEnd: 3, rowEnd: 4 }}
            alignWidth={1}
            stroke="rgb(0,120,215)"
          />
          {/* 1px + fill — fill should butt the stroke on all four sides */}
          <RangeRect
            range={{ colStart: 5, rowStart: 1, colEnd: 7, rowEnd: 4 }}
            alignWidth={1}
            stroke="rgb(16,124,16)"
            fill="rgba(16,124,16,0.15)"
          />
          {/* 2px (even) — trailing edges sit after the divider */}
          <RangeRect
            range={{ colStart: 1, rowStart: 6, colEnd: 3, rowEnd: 9 }}
            alignWidth={2}
            stroke="rgb(216,59,1)"
          />
          {/* 3px (odd) — centered, 1px each side */}
          <RangeRect
            range={{ colStart: 5, rowStart: 6, colEnd: 7, rowEnd: 9 }}
            alignWidth={3}
            stroke="rgb(136,23,152)"
          />
          {/* multiple disjoint ranges — render independently (one RangeRect each), no merge */}
          {[
            { colStart: 1, rowStart: 11, colEnd: 2, rowEnd: 12 },
            { colStart: 4, rowStart: 11, colEnd: 5, rowEnd: 12 }
          ].map((range, i) => (
            <RangeRect
              key={i}
              range={range}
              alignWidth={1}
              stroke="rgb(0,0,0)"
              fill="rgba(0,0,0,0.06)"
            />
          ))}
        </Layer>
      </Grid>
    </div>
  );
};

export const GridWithRanges = asStory(Template);
GridWithRanges.args = {
  columnCount: 50,
  rowCount: 50
};

GridWithRanges.storyName = "Range Rects";

const Story = {
  title: 'Grid',
  component: GridWithRanges,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
