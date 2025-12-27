// import type * as XLSXTypes from 'xlsx/types'; // TODO - add back

import {
  IWorkbook, ISheet, Scalar, ScalarType, ICell, NumberFormat
} from '@sheetxl/sdk';

import { WorkbookWriteHandler } from '../../registry';

import type { WriteXLSXOptions } from './Types';

/**
 * Converts a workbook model to an XLSX buffer.
 *
 * @param wbModel The workbook instance to export.
 * @param _options Optional options for saving the workbook.
 * @returns A promise that resolves to an array buffer representing the XLSX file.
 */
export const writeBuffer: WorkbookWriteHandler = async (wbModel: IWorkbook, options?: WriteXLSXOptions): Promise<ArrayBufferLike> => {
  const XLSX = await import(/* webpackChunkName: "xlsx", webpackPrefetch: true */ 'xlsx');
  const wbJSON:IWorkbook.JSON = await wbModel.toJSON(true/*ignoreData*/);
  const wbx = XLSX.utils.book_new();

  for (let i=0; i<wbJSON.sheets.length; i++) {
    const sheetRefJSON:IWorkbook.SheetRefJSON = wbJSON.sheets[i];
    const wsx:any = XLSX.utils.json_to_sheet([{}]); // :XLSXTypes.WorkSheet
    XLSX.utils.book_append_sheet(wbx, wsx, sheetRefJSON.name);
    // TODO - visibility and wb view

    const sheetJSON:ISheet.JSON = sheetRefJSON.sheet;

    const sheet = wbModel.getSheetAt(i);
    const range = sheet.getUsedRange();
    if (!range) {
      wsx['!ref'] = 'A1:A1';
    } else {
      wsx['!ref'] = range.getA1();
      range.forEach((value: Scalar, context: ICell.IteratorContext) => {
        const wsCell:any = { // :XLSXTypes.CellObject
          t: 'z' // as XLSXTypes.ExcelDataType
        };

        const cell:ICell = context.getCell();
        const style = cell.getStyle();
        if (!style.isNormal()) {
          let numFmt: string = style.getNumberFormat();
          // TODO - review these
          if (numFmt !== NumberFormat.Type.General) {
            if (numFmt === NumberFormat.Type.ShortDate) {
              numFmt = `m/d/yyyy`;
            } else if (numFmt === NumberFormat.Type.MediumDate) {
              numFmt = `d-mmm-yy`;
            } else if (numFmt === NumberFormat.Type.LongDate) {
              numFmt = `[$-x-sysdate]dddd, mmmm dd, yyyy`;
            } else if (numFmt === NumberFormat.Type.ShortTime) {
              numFmt = `h:mm`;
            } else if (numFmt === NumberFormat.Type.MediumTime) {
              numFmt = `h:mm AM/PM`;
            } else if (numFmt === NumberFormat.Type.LongTime) {
              numFmt = `h:mm:ss AM/PM`;
            }
            wsCell.z = numFmt;
          }
        }

        if (value !== null) {
          switch (context.getType()) {
            case ScalarType.Number:
              wsCell.t = 'n';
              wsCell.v = value as number;
              break;
            case ScalarType.String:
              wsCell.t = 's';
              wsCell.v = value as string;
              break;
            case ScalarType.Boolean:
              wsCell.t = 'b';
              wsCell.v = value as boolean;
              break;
            case ScalarType.Error:
              wsCell.t = 'e';
              wsCell.v = value.toString() as string;
              break;
            case ScalarType.RichData:
              break;
          }
        }
        wsx[context.getA1()] = wsCell;
      });
    }
    if (sheetJSON.merges?.length > 0) {
      const mergeSX = [];
      wsx['!merges'] = mergeSX;
      for (let m=0; m<sheetJSON.merges.length; m++) {
        mergeSX.push(XLSX.utils.decode_range(sheetJSON.merges[m]));
      }
    }
    if (sheetJSON.cols?.length > 0) {
      const colsSX = [];
      wsx['!cols'] = colsSX;
      const cols = sheetJSON.cols;
        const colSXDefault:any = {
        width: sheetJSON.defaultColSize ?? sheet.getColumnWidthAsFontUnit(sheet.getColumnHeaders().getDefaultSize())
        }

      // We need to move to ExcelJS as this api is not streaming, no styles, and no runs
      // write_ws_xml_cols
      const colsLength = cols.length;
      for (let c=0; c<colsLength; c++) {
        const col = cols[c];
        // TODO - move to our own solution SheetJS doesn't support writing runs.
        const from = colsSX.length;
        for (let j=from; j<=col.min-1; j++) {
          colsSX.push(colSXDefault);
        }

        const colSX:any = {}
        if (col.sz !== undefined) {
          colSX.width = col.sz;
        }
        if (col.h !== undefined) {
          colSX.hidden = col.h;
        }
        if (col.l !== undefined) {
          colSX.level = col.l;
        }
        for (let j=col.min; j<=col.max; j++) {
          colsSX.push(colSX);
        }

      }
    }
  }

  // !rows - write_ws_xml_rows
  // write_sty_xml

  XLSX.write(wbx, { type: "array", bookType: "xlsx" });
  const u8 = XLSX.write(wbx, { type: "array", bookType: "xlsx" });

  return u8;
}