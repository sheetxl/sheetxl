import React, { useCallback } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Layer, RangeRect, DefaultCellRenderer,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

const RANGE: RangeCoords = { rowStart: 2, colStart: 1, rowEnd: 6, colEnd: 4 };
const RANGE_TUNED: RangeCoords = { rowStart: 2, colStart: 6, rowEnd: 6, colEnd: 9 };

/**
 * The marching-ants **animated stroke** — the copy/cut marquee. A marquee is a solid background stroke
 * with an `animatedStroke` foreground stacked on the **same** range (exactly what `useSheetCopyPaste`
 * renders): the dashes march over the solid base. The first range uses the defaults; the second tunes
 * the dash/speed via `AnimatedStrokeProps`. This is the visual test for the copy/cut indicator.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value="" />;
  }, []);

  const element = (
    <Grid
      {...rest}
      columnCount={columnCount}
      rowCount={rowCount}
      style={{ flex: '1 1 100%', border: '1px solid black' }}
      renderCells={renderCells}
      showGridLines={true}
    >
      {/* One Layer hosting the marquee decorations (RangeRects stack by DOM order within it). */}
      <Layer key="marquees">
        {/* Copy marquee: solid base stroke + an animated (marching-ants) foreground on the same range. */}
        <RangeRect key="bg" range={RANGE} alignWidth={2} stroke="white" />
        <RangeRect key="fg" range={RANGE} alignWidth={2} stroke="rgb(33, 115, 70)" animatedStroke />
        {/* Tuned: longer dashes, faster march (AnimatedStrokeProps). */}
        <RangeRect key="bg-tuned" range={RANGE_TUNED} alignWidth={2} stroke="white" />
        <RangeRect
          key="fg-tuned"
          range={RANGE_TUNED}
          alignWidth={2}
          stroke="rgb(216, 59, 1)"
          animatedStroke={true}//{ dashLength: 10, dashGap: 4, speed: 20 }}
        />
      </Layer>
    </Grid>
  );
  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          <strong>left</strong> default marquee &nbsp;·&nbsp; <strong>right</strong> tuned (longer dashes, faster)
        </div>
        {element}
      </div>
    </div>
  );
};

export const AnimatedStroke = asStory(Template);
AnimatedStroke.args = { columnCount: 60, rowCount: 60 };
AnimatedStroke.storyName = 'Animated stroke (copy marquee)';

const Story = {
  title: 'Layers',
  component: AnimatedStroke,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
