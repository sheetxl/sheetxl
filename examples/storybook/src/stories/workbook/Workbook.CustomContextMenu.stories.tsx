import React from 'react';

import { Box } from '@mui/material';

import { Studio } from '@sheetxl/studio-mui'; // , Workbook

/*
export interface CommandEntryPoint {
  command: ICommand<any, any>;
  isBefore: boolean; // defaults to false
  //when: string
}
*/

/**
 * TODO - *Not implemented - This is a work in progress. The API is not finalized.
 */

/**
 * This example customizes the context menu by adding a custom command.
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
          // insertCommands={{
          //   "customCommand": {
          //     label: "Custom Command",
          //     execute: (context) => {
          //       console.log("Custom Command", context);
          //     },
          //     // when?
          //   }
          // }}
          // insertCommandButtons={{
          //   'toolbar.home.format': {
          //     command: string or OCommand
          //     render: function that returns a widget // default to a commandButton
          //     after: false // before or after entry point. @defaultValue false
          //   }
          // }}
        />
      </Box>
    );
  };

  return <App />;
};

export const WorkbookAppCustomContextMenu = Template.bind({});
WorkbookAppCustomContextMenu.storyName = "Custom Context Menu";
WorkbookAppCustomContextMenu.args = {
};

const Story = {
  title: 'Workbook/Custom Context Menu',
  component: Studio,
  tags: ['experimental', 'draft', '!dev'],
};
export default Story;