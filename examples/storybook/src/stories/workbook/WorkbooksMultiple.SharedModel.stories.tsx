import React from 'react';

import { Workbook } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/studio-mui';

const Template: React.FC = (props) => {
  const {
    workbook = new Workbook(),
    ...rest
  } = props as any;

  const App = () => {
    return (
      <div
        style={{ // We want to take full area
          width: "100%",
          height: "100%",
          minHeight: "400px",
          position: "relative",
          display: "flex",
          flexDirection: 'column'
        }}
      >
        <WorkbookElement
          style={{
            flex: "1",
          }}
          workbook={workbook}
          {...rest}
        />
        <div style={{flex: 'none', width: '100%', display: 'flex', alignItems: 'center', padding: '6px 4px'}}>
          <div style={{flex: 'none', paddingRight: '10px'}}>We have one shared model:</div>
          <input style={{flex: '1 1 100%'}} name="input-copy" defaultValue={"You can copy/paste text here but this is just for demoing..."}/>
          <div style={{flex: '1 1 50%'}}/>
        </div>
        <WorkbookElement
          style={{
            flex: "1",
          }}
          workbook={workbook}
        />
      </div>
    );
  };

  return <App />;
};

export const multipleWorkbooksSharedModel = Template.bind({});
multipleWorkbooksSharedModel.storyName = "Shared Models";

const Story = {
  title: 'Workbook/Multiple/Shared Models',
  component: multipleWorkbooksSharedModel
};

export default Story;