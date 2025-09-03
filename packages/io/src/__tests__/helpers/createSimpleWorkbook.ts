import { CellCoords } from '@sheetxl/utils';

import { Workbook, IWorkbook } from '@sheetxl/sdk';

const createSimpleWorkbook = (offset?: CellCoords): IWorkbook => {
  // Create a workbook
  const workbook = new Workbook();
  const ws = workbook.getSheets().getByName('Sheet1')!;

  const colStart = offset?.colIndex ?? 0;
  const rowStart = offset?.rowIndex ?? 0;
  const range = ws.getRange({
    colStart,
    rowStart,
    colEnd: colStart + 1,
    rowEnd: rowStart + 1
  });
  range.setValues([
    ['This is a string with spaces.', new Date(1995, 9, 23)], // 10-23-95
    [234, true]
  ]);

  return workbook;
}

export default createSimpleWorkbook;