import React, { useState } from 'react';

import { Worksheet } from '@sheetxl/sdk';

import { WorksheetElement } from '@sheetxl/react';

import { asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    showRowHeaders,
    showColumnHeaders,
    ...rest
  } = props as any;

  const [sheet] = useState(() => {
    return new Worksheet({
      json: {
        entireSize: {
          width: maxColumns,
          height: maxRows
        }
      }
    });
  });

  return (
    <WorksheetElement
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

export const BaseSheet = asStory(Template);

BaseSheet.args = {
  maxRows: 100,
  maxColumns: 50,
  showRowHeaders: true,
  showColumnHeaders: true
};

BaseSheet.storyName = "Base";

const Story = {
  title: 'Sheet/Base',
  component: WorksheetElement,
};
export default Story;
