import React from 'react';

import { Grid } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  // The Grid needs no size of its own — it fills its container. `.storybook-container` is just a
  // full-height flex box (see .storybook/preview-head.html); for a client this is any sized element.
  return (
    <div className="storybook-container">
      <Grid
        {...rest}
        renderCells={sharedCellRenderer}
      />
    </div>
  );

};

export const DefaultGrid = asStory(Template);
DefaultGrid.args = {
  columnCount: 8,
  rowCount: 15
};

DefaultGrid.storyName = "Grid";

const Story = {
  title: 'Grid',
  component: Grid,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;