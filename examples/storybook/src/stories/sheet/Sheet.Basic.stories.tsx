import React, { useState } from 'react';

import { Sheet } from '@sheetxl/sdk';

import { SheetElement } from '@sheetxl/react';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    showRowHeaders,
    showColumnHeaders,
    ...rest
  } = props as any;

  const [sheet] = useState(() => {
    return new Sheet({
      maxColumns,
      maxRows
    });
  });

  return (
    <SheetElement
      style={{
        // minHeight: '400px',
        minHeight: '100%',
        border: 'blue solid 2px',
        borderRadius: '8px', // note - the scrollbars will overflow. To fix this set the w
        flex: "1",
      }}
      sheet={sheet} // Required
      showRowHeaders={showRowHeaders}
      showColumnHeaders={showColumnHeaders}
      {...rest}
    />
  );
};

export const BaseSheet = Template.bind({});

BaseSheet.args = {
  maxRows: 100,
  maxColumns: 50,
  showRowHeaders: true,
  showColumnHeaders: true
};

BaseSheet.storyName = "Base";

const Story = {
  title: 'Sheet',
  component: SheetElement,
};
export default Story;
