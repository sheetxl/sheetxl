import React from 'react';

import {
  DefaultCellRenderer, CellRendererProps, ScrollableGrid as Grid
} from '@sheetxl/grid-react';

const sharedCellRenderer = (props: CellRendererProps) => {
  const {
    style: propStyle,
    key,
    ...rest
  } = props;
  const range = props.range;
  return (
    <DefaultCellRenderer
      key={key}
      {...rest}
      style={{
        ...propStyle,
        //background: `${(range.colStart % 4 === 0 ? 'rgb(232 246 255)' : range.rowStart % 3 === 0 ? '#eee' : 'transparent')}`
        background: `${(range.colStart % 4 === 0 ? 'rgba(30, 167, 253, 0.1)' : range.rowStart % 3 === 0 ? '#eee' : 'transparent')}`
      }}
      value={`${props.range.rowStart}:${props.range.colStart}`}
    />
  )
}

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        cellRenderer={sharedCellRenderer}
        getColumnWidth={(index: number): number => {
          if (index % 4 === 0) return 180;
          return 60;
        }}
        getRowHeight={(index: number): number => {
          if (index % 3 === 0) return 60;
          return 20;
        }}
      />
    </div>
  );
};

export const GridWithVariableSizes = Template.bind({});
GridWithVariableSizes.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithVariableSizes.storyName = "with Variable Sizes";

const Story = {
  title: 'Grid',
  component: GridWithVariableSizes,
  parameters: { GridWithVariableSizes: { sort: 'requiredFirst' } }
};
export default Story;