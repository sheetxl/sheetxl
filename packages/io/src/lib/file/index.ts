import { CommonUtils } from '@sheetxl/utils';

export const arrayToFile = async (fileNameWithExt: string, array: ArrayBuffer): Promise<void> => {
  const isNode = CommonUtils.isNode();
  if (isNode) {
    const { arrayToFile: arrayToFileEv } = await import(/* @vite-ignore */ /* webpackIgnore: true */ './file.node');
    await arrayToFileEv(fileNameWithExt, array);
  } else {
    const { arrayToFile: arrayToFileEv } = await import(/* @vite-ignore */ /* webpackIgnore: true */ './file.browser');
    await arrayToFileEv(fileNameWithExt, array);
  }
}