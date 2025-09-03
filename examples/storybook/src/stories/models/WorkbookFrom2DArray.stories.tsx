import React, { CSSProperties, useRef, useMemo } from 'react';

import {
  IWorkbook, Workbook, ISheet, Sheet
 } from '@sheetxl/sdk';

import { Studio, IWorkbookElement, WorkbookLoadEvent } from '@sheetxl/studio-mui';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    ...rest
  } = props as any;

  /*
   * Create a simple workbook. Wrap in a memo so that it is only created once.
   */
  const workbook:IWorkbook = useMemo(() => {
    const wb = new Workbook({
      createSheetCallback: (options: ISheet.ConstructorOptions) => {
        return new Sheet({
          ...options,
          maxRows,
          maxColumns
        });
      }
    });
    wb.getSelectedSheet().getRange('A1:C3').setValues([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]);
    return wb;
  }, [maxRows, maxColumns]);

  const style:CSSProperties = {
    border: 'blue solid 2px',
    borderRadius: '8px',
    flex: '1 1 100%',
    minHeight: "460px", // arbitrary min height to layout nicely.
  }

  // Note used but for illustration purposes.
  const refIWorkbookElement = useRef<IWorkbookElement>(null);

  return (
    <Studio
      sx={style}
      ref={refIWorkbookElement}
      onElementLoad={(e: WorkbookLoadEvent) => {
        // The on load source has the workbookElement and so does the ref.
        // From a workbook element you can
        const wbElement1 = refIWorkbookElement.current;
        const wbElement2 = e.source;
        const _wb1 = wbElement1.getWorkbook();
        const _wb2 = wbElement2.getWorkbook();
      }}
      {...rest}
      workbook={workbook}
      title='From 2D Array'
    />
  );
};

export const WorkbookFrom2DArray = Template.bind({});
WorkbookFrom2DArray.args = {
  maxRows: 100,
  maxColumns: 20
};
WorkbookFrom2DArray.storyName = "From 2D Array";

const Story = {
  title: 'Models/From 2D Array',
  component: WorkbookFrom2DArray,
  // tags: ['autodocs'],
};

export default Story;