import { Workbook, type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import * as CompressUtils from '@sheetxl/io/lib/compress';

/**
 * Import for reading from a SXL array buffer into an IWorkbook.
 *
 * @param array The array buffer containing the SXL data.
 * @param options Options for reading the workbook.
 * @returns A promise that resolves to an IWorkbook instance.
 */
export const readSXL: IWorkbookIO.ReadHandler = async (
  array: ArrayBufferLike,
  options?: Omit<IWorkbookIO.ReadOptions, 'source'>
): Promise<IWorkbook> => {
  let decodedArray:ArrayBufferLike = array;
  if (CompressUtils.isLikelyCompressedByMagicNumber(decodedArray)) {
    decodedArray = await CompressUtils.decompressArrayBuffer(decodedArray);
  }
  // console.profile('readSXL');
  let decodedString = new TextDecoder().decode(decodedArray);
  const jsonWB:IWorkbook.JSON = JSON.parse(decodedString);

  const optionsCreateWB:IWorkbook.ConstructorOptions = {
    ...options?.createWorkbookOptions ?? {},
    json: jsonWB,
  }

  const workbook = new Workbook(optionsCreateWB);
  // console.profileEnd('readSXL');
  return workbook;
}
