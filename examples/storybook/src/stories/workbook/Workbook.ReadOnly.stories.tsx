import React from 'react';

import { Box } from '@mui/material';

import { Studio } from '@sheetxl/studio-mui'; // , Workbook


/**
 * This example marks a workbook as readonly which will make  customizes the context menu by adding a custom command.
 */
const Template: React.FC = () => {

  const App = () => {
    return (
      <Box
        sx={{
          width: '100%', // to layout in storybook
          height: '100%', // to layout in storybook
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          rowGap: '4px',
        }}
      >
        <Studio
          sx={{
            flex: '1 1 100%'
          }}
          renderContextMenu={() => <></>}
          propsTabs={{
            renderContextMenu: () => <></>,
            readOnly: true
          }}
        />
      </Box>
    );
  };

  return <App />;
};

export const WorkbookReadOnly = Template.bind({});
WorkbookReadOnly.args = {

};

WorkbookReadOnly.storyName = "Disable ContextMenu";

const Story = {
  title: 'Workbook/Disable ContextMenu',
  component: Studio,
};
export default Story;