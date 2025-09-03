import React from 'react';

import { WorkbookElement } from '@sheetxl/studio-mui';

const Template: React.FC = () => {
  const App = () => {
    return (
      <WorkbookElement/>
    );
  };

  return <App />;
};

export const WorkbookBase = Template.bind({});
WorkbookBase.args = {
};

WorkbookBase.storyName = "Base";

const Story = {
  title: 'Workbook',
  component: WorkbookBase,
};
export default Story;