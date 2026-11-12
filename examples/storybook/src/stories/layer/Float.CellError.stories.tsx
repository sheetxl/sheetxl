import React, { useMemo } from 'react';

import { Workbook, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * **`CellErrorLayer` (default-on) — hover tooltips for cells that carry errors.** This mounts a real
 * `WorkbookElement`; `CellErrorLayer` is wired into `WorksheetElement`'s default layer stack, so hovering a
 * cell whose formula produced a calc error (`getErrors()`) floats a tip via the shared hover intent.
 *
 * The seeded cells below hold error values (they render their `#…` value). Hover one — after
 * `openDelay` the tip appears on the cell's top edge; move onto the tip to keep it. Toggle the whole
 * feature with the `showCellErrors` prop on the sheet/workbook element.
 */

const ERROR_CELLS: { address: string; value: string }[] = [
  { address: 'B2', value: '#DIV/0!' },
  { address: 'D4', value: '#N/A' },
  { address: 'F6', value: '#NAME?' },
  { address: 'C9', value: '#REF!' },
];

const Template: React.FC = () => {
  const workbook = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    const sheet: IWorksheet = wb.getSelectedWorksheet()!;
    sheet.getRange('A1').setValue('Hover the # cells (B2, D4, F6, C9) for the error tooltip →');
    for (const { address, value } of ERROR_CELLS) sheet.getRange(address).setValue(value);
    return wb;
  }, []);

  return (
    <div className="storybook-container" style={{ height: '100%' }}>
      <WorkbookElement workbook={workbook} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export const CellErrors = asStory(Template);
CellErrors.storyName = 'Cell errors (CellErrorLayer, default-on)';

const Story = {
  title: 'Float',
  component: CellErrors
};
export default Story;
