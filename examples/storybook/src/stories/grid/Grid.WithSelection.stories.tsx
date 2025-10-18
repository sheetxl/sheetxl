import React, { useCallback, useRef, useState } from 'react';

import { SelectionCoords } from '@sheetxl/utils';

import {
  DefaultCellRenderer, CellRendererProps, ScrollableGrid as Grid, IGridElement, useSelection
} from '@sheetxl/grid-react';

const Template: React.FC = (props) => {
  const {
    rowCount,
    ...rest
  } = props as any;

  const gridRef = useRef<IGridElement>(null);
  const [selection, setSelection] = useState<SelectionCoords>(() => {
    return {
      cell: {
        colIndex: 2,
        rowIndex: 2,
      },
      ranges: [{
        colStart: 2,
        rowStart: 2,
        colEnd: 3,
        rowEnd: 20

      }]
    }
  });

  const renderCell = useCallback((props: CellRendererProps) => {
    const {
      style: propStyle,
      key,
      ...rest
    } = props;
    return (
      <DefaultCellRenderer
        key={key}
        {...rest}
        style={{
          ...propStyle,
          // We are making the background color a percent of the rowcount base on rowIndex
          background: `rgba(232, 246, 255, ${props.range.rowStart / rowCount})`
        }}

        value={`${props.range.rowStart}:${props.range.colStart}`}
      />
    )
  }, [rowCount]);

  const {
    // commands: commandsSelection,
    renderOverlay: renderSelection,
    ...selectionProps // used for callbacks
  } = useSelection({
    selection,
    onSelectionChange: (selection: SelectionCoords) => setSelection(selection),
    gridRef
  });

  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        rowCount={rowCount}
        ref={gridRef}
        renderCell={renderCell}
        // onKeyDown={(e: React.KeyboardEvent<any>) => {
        //   commandsSelection.onKeyDown(e);
        // }}
        onPointerDown={(e: React.PointerEvent<any>) => {
          selectionProps.onPointerDown(e);
        }}
        renderOverlays={[renderSelection]}
      />
    </div>
  );
};

export const GridWithSelection = Template.bind({});
GridWithSelection.args = {
  columnCount: 200,
  rowCount: 100000
};

GridWithSelection.storyName = "with Selection";

const Story = {
  title: 'Grid',
  component: GridWithSelection,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;