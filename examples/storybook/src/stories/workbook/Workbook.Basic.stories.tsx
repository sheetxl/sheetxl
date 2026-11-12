import React, { useMemo } from 'react';

import { Workbook, type IWorkbook, type IWorksheet, type ICellRange } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { asStory } from '../../components';

const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo<IWorkbook>(() => {
    const wb: IWorkbook = new Workbook();
    const sheet: IWorksheet = wb.getWorksheetAt(0);
    const range: ICellRange = sheet.getRange("A1:B1");
    range.setValues([["Hello", "World"]]);
    return wb;
  }, []);

  return <WorkbookElement workbook={workbook} />
};

export const WorkbookBase = asStory(Template);
WorkbookBase.args = {
};

WorkbookBase.storyName = "Base";

const Story = {
  title: 'Workbook',
  component: WorkbookBase,
};
export default Story;