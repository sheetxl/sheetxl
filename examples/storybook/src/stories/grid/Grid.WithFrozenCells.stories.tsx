import React, { useCallback, useRef, useMemo } from 'react';

import {
  DefaultCellRenderer, SelectionLayer, DefaultSelection,
  type CellRendererProps, type IGrid,
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    freezeTop,
    freezeLeft,
    columnCount = 200,
    rowCount = 200,
    ...rest
  } = props as any;

  const gridRef = useRef<IGrid>(null);

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 })
  }), [rowCount, columnCount]);

  const renderCells = useCallback((props: CellRendererProps) => {
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
          color: `${range!.rowStart < freezeTop || range!.colStart < freezeLeft ? 'blue' : undefined}`
        }}
        value={`${props.range!.rowStart}:${props.range!.colStart}`}
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
        columnCount={columnCount}
        rowCount={rowCount}
        renderCells={renderCells}
        freezeTop={freezeTop}
        freezeLeft={freezeLeft}
        propsFreezeLeft={freezeDividerProps}
        propsFreezeTop={freezeDividerProps}
      >
        <SelectionLayer key="selection" selection={selection} />
      </Grid>
    </div>
  );
};

export const GridWithFrozenCells = asStory(Template);
GridWithFrozenCells.args = {
  columnCount: 200,
  rowCount: 200,
  freezeTop: 5,
  freezeLeft: 4
};

GridWithFrozenCells.storyName = "Frozen Cells";

const Story = {
  title: 'Grid',
  component: GridWithFrozenCells,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;