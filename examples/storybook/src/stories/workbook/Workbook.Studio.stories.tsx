import React, { useRef } from 'react';

import { Studio, IWorkbookElement } from '@sheetxl/studio-mui';

const Template: React.FC = () => {

  // Not used but an illustration
  const refWorkbook = useRef<IWorkbookElement>(null);

  const App = () => {
    return (
      <Studio
        ref={refWorkbook}
      />
    );
  };

  return <App />;
};

export const WorkbookStudio = Template.bind({});
WorkbookStudio.args = {

};

WorkbookStudio.storyName = "Studio";

const Story = {
  title: 'Studio',
  component: Studio,
};
export default Story;