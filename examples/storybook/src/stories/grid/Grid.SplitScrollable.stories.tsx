import React, { useState, useRef } from 'react';

import { ScrollPane, ScrollableViewport } from  '@sheetxl/utils-react';

import { Grid, IGridElement } from '@sheetxl/grid-react';

import { sharedCellRenderer } from '../../components';

/**
 * TODO -
 * Decouple the horizontal scrolling
 * Make each grid 50%
 * Add 4 quadrants not just two.
 *
 * Add to split pane so that they can be dragged
 * Snap to cell bounds.
 * Show how to share rows/columns. This will use sheet
 */
const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  const [viewportTopLeft, setViewPortTopLeft] = useState<ScrollableViewport>(null);
  const [viewportTopRight, setViewPortTopRight] = useState<ScrollableViewport>(null);

  const gridRefTopLeft = useRef<IGridElement>(null);
  const gridRefTopRight = useRef<IGridElement>(null);

  return (
    <div className="storybook-container">
      <div
        style={{
          display:"flex"
        }}
      >
      <ScrollPane
        style={{border: 'grey solid 1px', flex: "1 1 50%"}}
        viewport={viewportTopLeft}
        showVerticalScrollbar={false} // We don't show the first vertical scroll bar
        onScrollViewport={(scrollPosition) => {
          gridRefTopLeft.current?.scrollTo(scrollPosition); // scroll ourself
          gridRefTopRight.current?.scrollTo({ top: scrollPosition.top });
        }}
      >
        <Grid
          {...rest}
          style={{
            width: '100%',
            height: '100%',
          }}
          onViewportChange={v => {
            setViewPortTopLeft(v);
            setViewPortTopRight((prev) => {
              return {
                ...prev,
                top: v.top
              };
            });
          }}
          ref={gridRefTopLeft}
          renderCell={sharedCellRenderer}
        />
      </ScrollPane>
      <ScrollPane
        style={{border: 'grey solid 1px', flex: "1 1 50%"}}
        viewport={viewportTopRight}
        onScrollViewport={(scrollPosition) => {
          gridRefTopLeft.current?.scrollTo({ top: scrollPosition.top });
          gridRefTopRight.current?.scrollTo(scrollPosition); // scroll ourself
        }}
      >
        <Grid
          style={{
            width: '100%',
            height: '100%',
          }}
          {...rest}
          onViewportChange={v => {
            setViewPortTopLeft((prev) => {
              return {
                ...prev,
                top: v.top
              };
            });
            setViewPortTopRight(v);
          }}
          ref={gridRefTopRight}
          renderCell={sharedCellRenderer}
        />
      </ScrollPane>
      </div>
    </div>
  );
};

export const SplitScrollable = Template.bind({});
SplitScrollable.args = {
  columnCount: 200,
  rowCount: 200
};

const Story = {
  title: 'Scrollable Grid',
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;