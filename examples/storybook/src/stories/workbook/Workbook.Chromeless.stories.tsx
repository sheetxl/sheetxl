import React, { useMemo } from 'react';

import { Workbook, type IWorkbook, type IWorksheet, type ICellRange } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * A "chromeless" workbook editor/viewer.
 *
 * It renders only the sheet, the tabs and scrollbars - useful for a file-preview pane
 * or applications that implement their own chrome (toolbar, formula bar, status bar, menus).
 */
const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo<IWorkbook>(() => {
    const wb: IWorkbook = new Workbook();
    const sheet: IWorksheet = wb.getWorksheetAt(0);
    const range: ICellRange = sheet.getRange("A1:B3");
    range.setValues([
      ["Chromeless", "Editor"],
      ["No", "MUI"],
      ["Just", "@sheetxl/react"]
    ]);
    return wb;
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '500px' }}>
      <WorkbookElement workbook={workbook} />
    </div>
  );
};

export const Chromeless = asStory(Template);
Chromeless.args = {};
Chromeless.storyName = "Chromeless";

const Story = {
  title: 'Workbook',
  component: Chromeless,
};
export default Story;
