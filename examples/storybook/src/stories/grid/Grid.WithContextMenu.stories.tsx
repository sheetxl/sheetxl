import React, { useRef, useState, useMemo } from 'react';

import {
  SelectionLayer, DefaultSelection, type IGrid
} from '@sheetxl/grid-react';

import { sharedCellRenderer, ScrollableGrid as Grid, asStory } from '../../components';

interface ContextMenuPosition {
  left: number;
  top: number;
  rowIndex: number;
  colIndex: number;
}

const ContextMenu = ({ left, top, rowIndex, colIndex }: ContextMenuPosition) => {
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
    columnCount = 200,
    rowCount = 200,
    ...rest
  } = props as any;

  const gridRef = useRef<IGrid>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 })
  }), [rowCount, columnCount]);

  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        ref={gridRef}
        columnCount={columnCount}
        rowCount={rowCount}
        renderCells={sharedCellRenderer}
        // context menu here
        onContextMenu={(e) => {
          // We get the view
          const view = gridRef.current!.getPaneFromClient(e.clientX, e.clientY);
          if (!view) return;
          // get the coords to display
          const cell = view.getCellFromPointer(e.clientX, e.clientY);
          if (!cell) return;
          const { rowIndex, colIndex } = cell;
          // the menu is positioned absolutely, so convert client → grid-relative pixels off the element
          const rect = gridRef.current!.getBoundingClientRect();
          setContextMenuPosition({
            left: e.clientX - rect.x + 3, // offset by our current border
            top: e.clientY - rect.y + 3,
            rowIndex,
            colIndex,
          });
          e.preventDefault();
        }}
        onPointerDown={(_e: React.PointerEvent<any>) => {
          setContextMenuPosition(null); // dismiss the context menu; SelectionLayer handles selection itself
        }}
      >
        <SelectionLayer key="selection" selection={selection} />
      </Grid>
      {contextMenuPosition && <ContextMenu {...contextMenuPosition} /> /* note - that this sits outsize of grid */}
    </div>
  );
};

export const GridWithContextMenu = asStory(Template);
GridWithContextMenu.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithContextMenu.storyName = "Context Menu";

const Story = {
  title: 'Grid',
  component: GridWithContextMenu,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;