import { useMemo, forwardRef } from 'react';

import {
  ScrollPane, Viewport, type ScrollPaneProps
} from '@sheetxl/utils-react';

import {
  Grid, type GridProps, type IGrid
} from '@sheetxl/grid-react';

export interface ScrollableGridProps extends GridProps, Omit<ScrollPaneProps, 'viewport' | 'children' | 'ref'> {}

/**
 * Storybook convenience: a `Grid` wrapped in a `ScrollPane`, both sharing one
 * `Viewport`. (Replaces the former `ScrollableGridSurface` library component — that wrapper
 * is now a 3-line composition, so it lives in the examples rather than the library.)
 */
export const ScrollableGrid = forwardRef<IGrid, ScrollableGridProps>((props, ref) => {
  const {
    showVerticalScrollbar,
    showHorizontalScrollbar,
    renderScrollbarHorizontal,
    renderScrollbarVertical,
    renderScrollCorner,
    style,
    className,
    ...gridProps
  } = props;

  const viewport = useMemo(() => new Viewport(), []);

  return (
    <ScrollPane
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...style
      }}
      viewport={viewport}
      showVerticalScrollbar={showVerticalScrollbar}
      showHorizontalScrollbar={showHorizontalScrollbar}
      renderScrollbarHorizontal={renderScrollbarHorizontal}
      renderScrollbarVertical={renderScrollbarVertical}
      renderScrollCorner={renderScrollCorner}
    >
      <Grid
        {...gridProps}
        style={{ width: '100%', height: '100%' }}
        viewport={viewport}
        ref={ref}
      />
    </ScrollPane>
  );
});
ScrollableGrid.displayName = 'ScrollableGrid';
