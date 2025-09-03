import React, { useRef, useState } from 'react';

import { Tooltip } from '@mui/material';

import { SelectionCoords } from '@sheetxl/utils';

import {
  ScrollableGrid as Grid, useSelection, IGridElement
} from '@sheetxl/grid-react';

import { sharedCellRenderer } from '../../components';


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
    ...rest
  } = props as any;

  const gridRef = useRef<IGridElement>(null);
  const [selection, setSelection] = useState<SelectionCoords>(null);

  const [hoverText, setHoverText] = useState<string>();

  const positionRef = React.useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    // right: 0,
    // bottom: 0
  });

  const popperRef = React.useRef(null);

  const handlePointerMove = (e: React.PointerEvent<any>):void => {
    const view = gridRef.current.getViewFromClient(e.clientX, e.clientY);
    // now we get the offset since we are adding menu as absolute
    if (!view) return;
    // get the coords to display
    const coords = view.getCellCoordsFromClient(e.clientX, e.clientY);
    const point = view.getRelativePointFromClient(0,0);//e.clientX, e.clientY);

    const layout = view.getLayout();
    // We want our tooltip to snap to be to the right or the cell
    const x = layout.getColOffset(coords.colIndex) - point.x;
    const y = layout.getRowOffset(coords.rowIndex) - point.y;
    const right = layout.getColOffset(coords.colIndex + 1) - point.x;
    const bottom = layout.getRowOffset(coords.rowIndex + 1) - point.y;

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

  const {
    // commands: commandsSelection,
    overlay: overlaySelection,
    ...selectionProps // used for callbacks
  } = useSelection({
    gridRef,
    selection,
    onSelectionChange: (selection: SelectionCoords) => setSelection(selection),
  });

  return (
    <Tooltip
      arrow
      // disableInteractive
      title={<a href="https://www.sheetxl.com">Hover over {hoverText}</a>}
      placement="right"//right"
      PopperProps={{
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
      }}
    >
      <div className="storybook-container">
        <Grid
          {...rest}
          ref={gridRef}
          cellRenderer={sharedCellRenderer}
          // onKeyDown={(e: React.KeyboardEvent<any>) => {
          //   commandsSelection.onKeyDown(e);
          // }}
          onPointerDown={(e: React.PointerEvent<any>) => {
            selectionProps.onPointerDown(e);
          }}
          onPointerMove={handlePointerMove}
          overlays={[overlaySelection]}
        />
      </div>
    </Tooltip>
  );
};

export const GridWithTooltip = Template.bind({});
GridWithTooltip.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithTooltip.storyName = "with Tooltip";

const Story = {
  title: 'Grid',
  component: GridWithTooltip,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;