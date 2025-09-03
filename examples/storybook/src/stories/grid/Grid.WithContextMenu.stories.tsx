import React, { useRef, useState } from 'react';

import {
  ScrollableGrid as Grid, useSelection, IGridElement
} from '@sheetxl/grid-react';

import { sharedCellRenderer } from '../../components';

const ContextMenu = ({ left, top, rowIndex, colIndex }) => {
  return (
    <div
      style={{
        left,
        top,
        position: "absolute",
        padding: 8,
        background: "white",
        boxShadow: "0 1px 2px 3px rgba(0,0,0,0.2)",
      }}
    >
      <div>
        You selected {rowIndex}: {colIndex}
      </div>
      {/* <a href="#" style={{ display: "block", padding: 8 }}>
        Hide column
      </a> */}
    </div>
  );
};

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  const gridRef = useRef<IGridElement>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState(null);

  const {
    // commands: commandsSelection,
    overlay: overlaySelection,
    selection,
    ...selectionProps // used for callbacks
  } = useSelection({
    gridRef
  });
  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        ref={gridRef}
        cellRenderer={sharedCellRenderer}
        // context menu here
        onContextMenu={(e) => {
          // We get the view
          const view = gridRef.current.getViewFromClient(e.clientX, e.clientY);
          // now we get the offset since we are adding menu as absolute
          const relativePoint = gridRef.current.getRelativePointFromClient(e.clientX, e.clientY);
          if (!view) return;
          // get the coords to display
          const { rowIndex, colIndex, } = view.getCellCoordsFromClient(e.clientX, e.clientY);
          setContextMenuPosition({
            left: relativePoint.x + 3, // offset by our current border
            top: relativePoint.y + 3,
            rowIndex,
            colIndex,
          });
          e.preventDefault();
        }}
        // onKeyDown={(e: React.KeyboardEvent<any>) => {
        //   commandsSelection.onKeyDown(e);
        // }}
        onPointerDown={(e: React.PointerEvent<any>) => {
          setContextMenuPosition(null); // context menu here, notice it's before we pass to selection
          selectionProps.onPointerDown(e);
        }}
        overlays={[overlaySelection]}
      />
      {contextMenuPosition && <ContextMenu {...contextMenuPosition} /> /* note - that this sits outsize of grid */}
    </div>
  );
};

export const GridWithContextMenu = Template.bind({});
GridWithContextMenu.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithContextMenu.storyName = "with Context Menu";

const Story = {
  title: 'Grid',
  component: GridWithContextMenu,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;