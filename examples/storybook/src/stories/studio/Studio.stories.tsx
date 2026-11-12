import React, { useRef } from 'react';

import { Studio, type IStudioElement } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

const Template: React.FC = () => {

  // Not used but an illustration
  const refStudio = useRef<IStudioElement>(null);

  const App = () => {
    return (
      <Studio
        ref={refStudio}
      />
    );
  };

  return <App />;
};

export const StudioDefault = asStory(Template);
StudioDefault.args = {

};

StudioDefault.storyName = "Studio";

const Story = {
  title: 'Studio',
  component: Studio,
};
export default Story;