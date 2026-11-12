import React, { useMemo } from 'react';

import { ScrollPane, Viewport, AxisViewport } from  '@sheetxl/utils-react';

import { Grid } from '@sheetxl/grid-react';

import { sharedCellRenderer, asStory } from '../../components';

/**
 * Split view: two grids that scroll vertically in lockstep but scroll horizontally independently.
 *
 * One shared vertical {@link Viewport} (a single rAF ticker ⇒ eased / touch-momentum scroll
 * stays frame-locked) drives both grids' vertical axis; each grid binds it via an {@link AxisViewport}
 * for vertical and its own controller for horizontal. The SAME AxisViewport instance is handed to each
 * grid AND its ScrollPane, so they stay in sync through one store.
 *
 * TODO -
 * Add 4 quadrants not just two.
 * Add to split pane so that they can be dragged
 * Snap to cell bounds.
 * Show how to share rows/columns. This will use sheet
 */
const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  // Shared vertical controller + per-grid horizontal controllers, composed per grid. Both grids drive
  // the shared vertical (followV=false), so either pane's vertical scroll moves both.
  const { left: viewportLeft, right: viewportRight } = useMemo(() => {
    const sharedVertical = new Viewport();
    const leftOwnH = new Viewport();
    const rightOwnH = new Viewport();
    return {
      left: new AxisViewport(leftOwnH, sharedVertical, false, false, sharedVertical),
      right: new AxisViewport(rightOwnH, sharedVertical, false, false, sharedVertical)
    };
  }, []);

  return (
    <div className="storybook-container">
      <div
        style={{
          display:"flex"
        }}
      >
      <ScrollPane
        style={{border: 'grey solid 1px', flex: "1 1 50%"}}
        viewport={viewportLeft}
        showVerticalScrollbar={false} // the shared vertical scroll is shown on the right pane only
      >
        <Grid
          {...rest}
          style={{
            width: '100%',
            height: '100%',
          }}
          viewport={viewportLeft}
          renderCells={sharedCellRenderer}
        />
      </ScrollPane>
      <ScrollPane
        style={{border: 'grey solid 1px', flex: "1 1 50%"}}
        viewport={viewportRight}
      >
        <Grid
          {...rest}
          style={{
            width: '100%',
            height: '100%',
          }}
          viewport={viewportRight}
          renderCells={sharedCellRenderer}
        />
      </ScrollPane>
      </div>
    </div>
  );
};

export const SplitScrollable = asStory(Template);
SplitScrollable.args = {
  columnCount: 200,
  rowCount: 200
};

const Story = {
  title: 'Scrollable Grid',
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
