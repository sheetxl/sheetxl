import React, { useMemo } from 'react';

import { Workbook, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * **Table hover UX.** Hovering a table shows its outline plus:
 * - the **table toolbar** (a `VirtualRangeFloat` inside `TableLayer`) pinned **top-right**, 4px below the
 *   top edge: a split button —
 *   the quick press edits the table, the dropdown lists the table commands. Storybook has no MUI, so
 *   this is the react default (Studio supplies its own through `renderTableToolbar`). Kept open while
 *   hovered, held open while its dropdown is up, `clamp`ed so it stays visible when the table's top
 *   scrolls under the headers. The dropdown is a float-stack popup: a right-click closes it.
 * - the Excel **resize tick** on the bottom-right corner (`TableLayer`) — drag it to grow/shrink the
 *   table (live preview, committed on release via `table.resize`).
 */

const Template: React.FC = () => {
  const workbook = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    const sheet: IWorksheet = wb.getSelectedWorksheet()!;
    sheet.getRange('B2:D2').setValues([['Region', 'Units', 'Revenue']]);
    sheet.getRange('B3:D6').setValues([
      ['East', 10, 100],
      ['West', 20, 250],
      ['North', 15, 175],
      ['South', 12, 140]
    ]);
    sheet.getTables().add('B2:D6');
    sheet.getRange('A1').select();
    return wb;
  }, []);

  return (
    <div className="storybook-container" style={{ height: '100%' }}>
      <WorkbookElement workbook={workbook} />
    </div>
  );
};

export const TableLabel = asStory(Template);
TableLabel.storyName = 'Table hover toolbar + resize';

const Story = {
  title: 'Float',
  component: TableLabel
};
export default Story;
