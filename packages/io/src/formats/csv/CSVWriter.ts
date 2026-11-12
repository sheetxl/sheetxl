import {
  type IWorkbookIO, type Scalar, type IRange, type ICell, type IWorkbook, type IWorksheet, type ICellRange
} from '@sheetxl/sdk';

// cspell:ignore papaparse, Unparse
import { type UnparseConfig } from 'papaparse';

import { type WriteCSVOptions } from './Types';

/**
 * Export to CSV.
 *
 * @param workbook The workbook model to export
 * @param options Export options
 * @returns A workbook model with a single sheet
 *
 * @remarks
 * This only exports the activeTab.
 */
export const writeCSV: IWorkbookIO.WriteHandler = async (
  workbook: IWorkbook,
  options?: WriteCSVOptions
): Promise<ArrayBufferLike> => {
  const {
    trimLeadingBlankRow = true,
    trimLeadingBlankColumn = true,
    ignoreHidden = false,
    sheetKey = null,
    papaParseConfig = {},
  } = options || {};

  // papaparse is CommonJS: Node puts its API on `default`; bundlers may flatten it.
  const imported = await import(/* webpackChunkName: "papaparse" */"papaparse");
  const papaparse = ((imported as any).default ?? imported) as typeof imported;
  if (!workbook)
    throw new Error('workbook must be specified');
  // TODO - put a limit on this?
  let sheet:IWorksheet | null = null;
  if (sheetKey === null) {
    sheet = workbook.getSelectedWorksheet();
  } else if (typeof sheetKey === 'number') {
    sheet = workbook.getWorksheets().getItems()[sheetKey];
  } else if (typeof sheetKey === 'string') {
    sheet = workbook.getWorksheets().getByName(sheetKey);
  }
  if (!sheet)
    throw new Error('invalid sheetKey specified');
  // Formula cells read as empty until the (asynchronous) calculation has settled.
  await sheet.whenCalculationReady();

  let currentRow: number | null = null; // 0 based
  const asArray:any[] = [];
  let currentCol:any[] | null = null;

  // `ignoreHidden` is sticky: it rides the returned range through `getOffsetTo` into the forEach.
  let range = sheet.getUsedRange({ ignoreHidden });
  if (!range) {
    throw new Error('Nothing to export'); // unable to parse
  }

  let address:Partial<IRange.Coords> | undefined = undefined;
  if (!trimLeadingBlankRow || !trimLeadingBlankColumn) {
    const rowStart = trimLeadingBlankRow ? range.getRowStart() : 0;
    const colStart = trimLeadingBlankColumn ? range.getColumnStart() : 0;
    range = range.getOffsetTo(rowStart, colStart);
  }
  range.forEach((value: Scalar, context: ICell.IteratorContext) => {
    const coords = context.getCoords();
    const cell = context.getCell();
    if (currentRow !== coords.rowIndex) {
      if (currentCol)
        asArray.push(currentCol);
      currentCol = [];
      currentRow = coords.rowIndex;
    }
    // What the cell shows, as Excel's Save As CSV writes it: `$1,234.50`, not 1234.5.
    const plainText = cell.getText(OptionsDisplayText) ?? '';
    currentCol!.push(plainText);
  }, {
    includeEmpty: true,
    address
  })
  // last one
  if (currentCol)
    asArray.push(currentCol);

  // Delimiter follows the workbook locale (Excel: `;` for a comma-decimal locale so the
  // file re-opens correctly in that region) — an explicit `papaParseConfig.delimiter` wins.
  // (The reader auto-detects, so no matching setting is needed there.)
  const config:UnparseConfig = {
    delimiter: sheet.getRuntime().getLocaleProfile().csvDelimiter,
    ...papaParseConfig
  }

  const asCSV = papaparse.unparse(asArray, config);
  const asBuffer:ArrayBufferLike = new TextEncoder().encode(asCSV).buffer;
  return asBuffer;
}

const OptionsDisplayText: ICell.GetTextOptions = { hideStringPrefix: true };