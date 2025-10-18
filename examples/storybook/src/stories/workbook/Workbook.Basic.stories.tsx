import React, { useMemo } from 'react';

import { Workbook, type IWorkbook, type ISheet, type ICellRange } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/studio-mui';


const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo<IWorkbook>(() => {
    const wb: IWorkbook = new Workbook();
    const sheet: ISheet = wb.getSheetAt(0);
    const range: ICellRange = sheet.getRange("A1:B1");
    range.setValues([["Hello", "World"]]);
    return wb;
  }, []);

  return <WorkbookElement workbook={workbook} />
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