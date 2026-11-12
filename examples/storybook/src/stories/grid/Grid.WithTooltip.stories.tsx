import React, { useRef, useState, useMemo } from 'react';

import { Tooltip, type PopperProps } from '@mui/material';

import {
  SelectionLayer, DefaultSelection, type IGrid
} from '@sheetxl/grid-react';

import { sharedCellRenderer, ScrollableGrid as Grid, asStory } from '../../components';

type PopperInstance = NonNullable<PopperProps['popperRef']> extends React.Ref<infer I> ? I : never;


/**
 * This is a work in progress.
 *
 * We are going to natively support Material tooltips by making the grid act like a standard component (forward refs correctly.)
 * Are 'virtualizing' the mouse events by creating a mouse enter/mouse exit/mouse move for each cell.
 *
 * // TODO - also account for scrolling
 */
const Template: React.FC = (props) => {
  const {
    columnCount = 200,
    rowCount = 200,
    ...rest
  } = props as any;

  const gridRef = useRef<IGrid>(null);

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 })
  }), [rowCount, columnCount]);

  const [hoverText, setHoverText] = useState<string>();

  const positionRef = React.useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    // right: 0,
    // bottom: 0
  });

  const popperRef = React.useRef<PopperInstance | null>(null);

  const handlePointerMove = (e: React.PointerEvent<any>):void => {
    const view = gridRef.current!.getPaneFromClient(e.clientX, e.clientY);
    // now we get the offset since we are adding menu as absolute
    if (!view) return;
    // get the coords to display
    const coords = view.getCellFromPointer(e.clientX, e.clientY);
    const point = view.getPanePointFromPointer(0,0);//e.clientX, e.clientY);
    if (!coords || !point) return;

    const metrics = view.getMetrics();
    // We want our tooltip to snap to be to the right or the cell
    const x = metrics.getColOffset(coords.colIndex) - point.x;
    const y = metrics.getRowOffset(coords.rowIndex) - point.y;
    const right = metrics.getColOffset(coords.colIndex + 1) - point.x;
    const bottom = metrics.getRowOffset(coords.rowIndex + 1) - point.y;

    positionRef.current = {
      x: x,
      y: y,
      width: right - x,
      height: bottom - y,
    }

    setHoverText(`This is a hover text for (${ coords.rowIndex }, ${ coords.colIndex })`);
    if (popperRef.current !== null) {
      popperRef.current.update();
    }
  };

  return (
    <Tooltip
      arrow
      // disableInteractive
      title={<a href="https://www.sheetxl.com">Hover over {hoverText}</a>}
      placement="right"//right"
      slotProps={{
        popper: {
          // style: { pointerEvents: 'none' },
          popperRef,
          anchorEl: {
            getBoundingClientRect: () => {
              return new DOMRect(
                positionRef.current.x,
                positionRef.current.y,
                positionRef.current.width,
                positionRef.current.height,
              );
            },
          },
          modifiers: [
            {
                name: "offset",
                options: {
                    offset: [0, 10], // We offset so that we can mouse away in the tooltip's direction
                },
            },
          ],
        }
      }}
    >
      <div className="storybook-container">
        <Grid
          {...rest}
          ref={gridRef}
          columnCount={columnCount}
          rowCount={rowCount}
          renderCells={sharedCellRenderer}
          onPointerMove={handlePointerMove}
        >
          <SelectionLayer key="selection" selection={selection} />
        </Grid>
      </div>
    </Tooltip>
  );
};

export const GridWithTooltip = asStory(Template);
GridWithTooltip.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithTooltip.storyName = "Tooltip";

const Story = {
  title: 'Grid',
  component: GridWithTooltip,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;