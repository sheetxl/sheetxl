import { Scalar, IRange, ICell, ICellRange, IWorkbook, Workbook, ISheet } from '@sheetxl/sdk';

// cspell:ignore papaparse, Unparse
import type { ParseConfig, UnparseConfig } from 'papaparse';

import type { WorkbookWriteHandler } from '../../types';
import type { WriteCSVOptions, ReadCSVOptions } from './Types';

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
export const writeBufferCSV: WorkbookWriteHandler = async (workbook: IWorkbook, options?: WriteCSVOptions): Promise<ArrayBufferLike> => {
  const {
    trimLeadingBlankRow = true,
    trimLeadingBlankColumn = true,
    ignoreHidden = false,
    sheetKey = null,
    papaParseConfig = {},
  } = options || {};

  const papaparse = await import(/* webpackChunkName: "papaparse", webpackPrefetch: true */"papaparse");
  if (!workbook)
    throw new Error('workbook must be specified');
  // TODO - put a limit on this?
  let sheet:ISheet = null;
  if (sheetKey === null) {
    sheet = workbook.getSelectedSheet();
  } else if (typeof sheetKey === 'number') {
    sheet = workbook.getSheets().getItems()[sheetKey];
  } else if (typeof sheetKey === 'string') {
    sheet = workbook.getSheets().getByName(sheetKey);
  }
  if (!sheet)
    throw new Error('invalid sheetKey specified');

  let currentRow = null; // 0 based
  const asArray:any[] = [];
  let currentCol:any[] = null;

  let range = sheet.getUsedRange({ ignoreHidden });
  if (!range) {
    throw new Error('Nothing to export'); // unable to parse
  }

  let address:Partial<IRange.Coords> = null;
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
    const plainText = cell.toTextUnformatted() ?? '';
    currentCol.push(plainText);
  }, {
    includeEmpty: true,
    address
  })
  // last one
  if (currentCol)
    asArray.push(currentCol);

  const config:UnparseConfig = {
    ...papaParseConfig
  }

  const asCSV = papaparse.unparse(asArray, config);
  const asBuffer:ArrayBufferLike = new TextEncoder().encode(asCSV).buffer;
  return asBuffer;
}

/**
 * Import from CSV.
 *
 * @param buffer The arraybuffer to import from.
 * @param options Options for CSVImport
 * @returns A workbook model with a single sheet
 *
 * @remarks
 * Creates a workbook with a single tab.
 */
export const readBufferCSV = async (buffer: ArrayBuffer, options?: ReadCSVOptions): Promise<IWorkbook> => {
  const {
    papaParseConfig,
    setValuesOptions,
    createWorkbookOptions
  } = options ?? {};

  const taskProgress = options?.progress;

  const onProgress = taskProgress?.onProgress;

  const papaparse = await import(/* webpackChunkName: "papaparse", webpackPrefetch: true */"papaparse");
  const asCSV:string = new TextDecoder().decode(buffer);

  let currentRow = -1; // 0 based

  const workbook = new Workbook(createWorkbookOptions);
  const sheet:ISheet = workbook.getSelectedSheet();

  const updates:ICellRange.IncrementalUpdater = sheet.getEntireRange().startIncrementalUpdates({ orientation: IRange.Orientation.Row });

  let updatesCount = 0;
  const populateTransform = (value: string, field: string | number): any => {
    if (papaParseConfig?.transform)
      value = papaParseConfig.transform(value, field);

    // TODO - if transformHeader then we get a field so need to check for this config
    const colIndex = field as number; // or mapped string
    if (colIndex === 0) {
      currentRow++;
    }
    // Excel doesn't quotePrefix on import. Make this an option?
    let update:Scalar = value ?? '';
    updates.pushAt(currentRow, colIndex, update);
    updatesCount++;
    if (updatesCount % 100000 === 0) {
      onProgress?.(updatesCount);
      // console.log(`CSV import: ${updatesCount} updates`);
    }

    return value;
  }

  const config:ParseConfig = {
    ...papaParseConfig,
    transform: populateTransform
  }
  papaparse.parse<any>(asCSV, config).data;

  updates.apply({
    textParser: true, // this is the default
    ...setValuesOptions
  });
  return workbook;
}

// export const registerCSV = (): void => {
//   const { registerWorkbookRead, registerWorkbookWrite } = require('../../registry');
//   registerWorkbookWrite('csv', toBufferCSV);
//   registerWorkbookRead('csv', fromBufferCSV);
// }