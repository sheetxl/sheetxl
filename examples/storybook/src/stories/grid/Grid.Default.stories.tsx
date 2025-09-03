import React from 'react';

import { Grid } from '@sheetxl/grid-react';

import { sharedCellRenderer } from '../../components';

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  return (
    <div
      style={{ // For Canvas view we want to take full area
        width: "100%",
        height: "100%",
        display: "flex",
        border: "green solid 1px"
      }}
    >
      <Grid
        {...rest}
        style={{ // For Docs view we are 400px by 'full width'
          minHeight: "400px",
          position: "relative",
          flex: "1",
          border: "blue solid 1px"
        }}
        cellRenderer={sharedCellRenderer}
      />
    </div>
  );

};

export const DefaultGrid = Template.bind({});
DefaultGrid.args = {
  columnCount: 200,
  rowCount: 200
};

DefaultGrid.storyName = "Default";

const Story = {
  title: 'Grid',
  component: Grid,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;