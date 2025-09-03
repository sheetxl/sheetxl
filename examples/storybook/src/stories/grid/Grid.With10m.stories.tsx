import React, { useCallback } from 'react';

import {
  DefaultCellRenderer, CellRendererProps, ScrollableGrid as Grid,
} from '@sheetxl/grid-react';

const Template: React.FC = (props) => {
  const {
    rowCount,
    ...rest
  } = props as any;

  const cellRenderer = useCallback((props: CellRendererProps) => {
    const {
      key,
      style: propStyle,
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

  return (
    <div className="storybook-container">
      <Grid
        style={{
          border: '1px solid grey',
        }}
        {...rest}
        rowCount={rowCount} // because we destructured the rowCount for rendering
        getColumnWidth={(index: number): number => {
          return 120; // to be more like google sheets
        }}
        cellRenderer={cellRenderer}
      />
    </div>
  );
};

export const GridWith10M = Template.bind({});
GridWith10M.args = {
  columnCount: 1000000,
  rowCount: 1000000
};

GridWith10M.storyName = "with 1B Cells";

const Story = {
  title: 'Grid',
  component: GridWith10M,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;