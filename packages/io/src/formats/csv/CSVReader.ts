import {
  type Scalar, IRange, type ICellRange, type IWorkbook, Workbook, type IWorksheet
} from '@sheetxl/sdk';

// cspell:ignore papaparse, Unparse
import { type ParseConfig } from 'papaparse';

import { type ReadCSVOptions } from './Types';

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
export const readCSV = async (
  buffer: ArrayBuffer,
  options?: ReadCSVOptions
): Promise<IWorkbook> => {
  const {
    papaParseConfig,
    setValuesOptions,
    createWorkbookOptions
  } = options ?? {};

  const taskProgress = options?.progress;

  const onProgress = taskProgress?.onProgress ? taskProgress.onProgress.bind(taskProgress) : undefined;

  // papaparse is CommonJS: Node puts its API on `default`; bundlers may flatten it.
  const imported = await import(/* webpackChunkName: "papaparse" */"papaparse");
  const papaparse = ((imported as any).default ?? imported) as typeof imported;
  const asCSV:string = new TextDecoder().decode(buffer);

  let currentRow = -1; // 0 based

  const workbook = new Workbook(createWorkbookOptions);
  // A new workbook has its one worksheet.
  const sheet:IWorksheet = workbook.getWorksheetAt(0);

  const entireCoords = sheet.getEntireRange().getCoords();
  const lastCol = entireCoords.colEnd;
  const lastRow = entireCoords.rowEnd;
  const builder:ICellRange.SparseBuilder = sheet.getEntireRange().createSparseBuilder({ axis: IRange.Axis.Row });

  let updatesCount = 0;
  let ignoredRows = 0;
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
    if (currentRow > lastRow || colIndex > lastCol) {
      if (colIndex === 0) { //} && update !== '') {
        ignoredRows++;
      }
      return;
    }
    builder.pushAt(currentRow, colIndex, update);
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

  builder.apply({
    textParser: true, // this is the default
    autoFormat: true,
    ...setValuesOptions
  });

  if (ignoredRows > 0) {
    taskProgress?.onWarning?.(`Ignored ${ignoredRows} ${ignoredRows === 1 ? 'row' : 'rows'} that exceeded the maximum range of the sheet`);
  }
  return workbook;
}
