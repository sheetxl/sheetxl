import React, { useCallback, useRef } from 'react';

import {
  DefaultCellRenderer, type CellRendererProps, ScrollableGrid as Grid,
  IGridElement, useSelection
} from '@sheetxl/grid-react';

const Template: React.FC = (props) => {
  const {
    freezeTop,
    freezeLeft,
    ...rest
  } = props as any;

  const gridRef = useRef<IGridElement>(null);

  const {
    selection,
    // commands: commandsSelection,
    renderOverlay: renderSelection,
    ...selectionProps // used for callbacks
  } = useSelection({
    gridRef
  });

  const renderCell = useCallback((props: CellRendererProps) => {
    const {
      key,
      style: propStyle,
      ...rest
    } = props;
    const range = props.range;
    return (
      <DefaultCellRenderer
        key={key}
        {...rest}
        style={{
          ...propStyle,
          color: `${range.rowStart < freezeTop || range.colStart < freezeLeft ? 'blue' : undefined}`
        }}
        value={`${props.range.rowStart}:${props.range.colStart}`}
      />
    )
  }, [freezeTop, freezeLeft]);

  const freezeDividerProps = {
    propsPath: {
      stroke: 'blue'
    }
  }
  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        ref={gridRef}
        renderCell={renderCell}
        freezeTop={freezeTop}
        freezeLeft={freezeLeft}
        propsFreezeLeft={freezeDividerProps}
        propsFreezeTop={freezeDividerProps}
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

export const GridWithFrozenCells = Template.bind({});
GridWithFrozenCells.args = {
  columnCount: 200,
  rowCount: 200,
  freezeTop: 5,
  freezeLeft: 4
};

GridWithFrozenCells.storyName = "with Frozen Cells";

const Story = {
  title: 'Grid',
  component: GridWithFrozenCells,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;