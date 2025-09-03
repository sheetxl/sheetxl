import React from 'react';

import { BaseGrid } from '@sheetxl/grid-react';

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
      <BaseGrid
        {...rest}
        style={{ // For Docs view we are 400px by 'full width'
          minHeight: '400px',
          flex: "1",
          border: 'blue solid 1px',
          position: 'relative'
        }}
        cellRenderer={sharedCellRenderer}
      />
    </div>
  );
};

export const BaseGridStory = Template.bind({});
BaseGridStory.args = {
  width: 800,
  height: 600,
  columnCount: 200,
  rowCount: 200
};

BaseGridStory.storyName = "Base";

const Story = {
  title: 'Grid',
  component: BaseGrid,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;