import React, { useCallback } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  DefaultCellRenderer, type CellRendererProps
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    rowCount,
    columnCount,
    ...rest
  } = props as any;

  const renderCells = useCallback((props: CellRendererProps) => {
    const {
      key,
      style: propStyle,
      ...rest
    } = props;
    const range: RangeCoords = props.range!;
    return (
      <DefaultCellRenderer
        key={key}
        {...rest}
        style={{
          ...propStyle,
          // We are making the background color a percent of the rowcount base on rowIndex
          background: `rgba(232, 246, 255, ${range.rowStart / rowCount})`
        }}

        value={`${range.rowStart}:${range.colStart}`}
      />
    )
  }, [rowCount, columnCount]);

  return (
    <div className="storybook-container">
      <Grid
        style={{
          border: '1px solid grey',
        }}
        {...rest}
        columnCount={columnCount}
        rowCount={rowCount} // because we destructured the rowCount for rendering
        getColumnWidth={(index: number): number => {
          return 120; // like google sheets
        }}
        renderCells={renderCells}
      />
    </div>
  );
};

export const GridWithLots = asStory(Template);
GridWithLots.args = {
  columnCount: 1000000,
  rowCount: 1000000
};

GridWithLots.storyName = "(1 Trillion) Cells";

const Story = {
  title: 'Grid',
  component: GridWithLots,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;