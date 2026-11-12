import React, { useMemo } from 'react';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { Studio } from '@sheetxl/studio-mui';

import {
  registerStoryCellControls, seedCellControls, addButtonMacro, RATING_CSS, BUTTON_CSS
} from '../../components/storyCellControls';

import { asStory } from '../../components';

/**
 * **Custom cell controls and rich values in the studio.** The same rating, slider, range values
 * and buttons as the sheet story, inside the full studio: the ribbon's alignment buttons move them
 * within their cells, zoom scales them, copy and paste carry them, undo takes back a Space over a
 * range, and **Insert ▸ Controls** becomes a split button listing them beside the checkbox (with
 * only the checkbox registered it is the plain checkbox button). Its last entry, **Control
 * Options**, opens the pane for the active cell: a slider's bounds, a range value's bounds, a
 * button's label and macro. The story adds a `stampTime` macro for the first button. Save as
 * `.sxl` keeps them; `.xlsx` keeps only the checkbox, which Excel knows, and warns about the rest.
 */
registerStoryCellControls();

const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo(() => {
    const wb = new Workbook();
    const sheet = wb.getSelectedWorksheet()!;
    seedCellControls(sheet);
    void addButtonMacro(sheet);
    return wb;
  }, []);
  return (
    <>
      <style>{RATING_CSS + BUTTON_CSS}</style>
      <Studio workbook={workbook} title="Cell controls" />
    </>
  );
};

export const StudioWithCellControls = asStory(Template);
StudioWithCellControls.storyName = 'With cell controls';

const Story = {
  title: 'Studio',
  component: StudioWithCellControls,
};
export default Story;
