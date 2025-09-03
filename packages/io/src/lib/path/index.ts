// This file acts as the entry point for TypeScript.
// It just re-exports the browser version. This is ONLY for type-checking.
// The `package.json` exports map will ensure the correct file is used at build time.
export * from './path.browser';

// import { CommonUtils } from '@sheetxl/utils';

// export const arrayToFile = async (fileNameWithExt: string, array: ArrayBuffer): Promise<void> => {
//   const isNode = CommonUtils.isNode();
//   if (isNode) {
//     const { arrayToFile: arrayToFileEv } = await import(/* @vite-ignore */ /* webpackIgnore: true */ './path.node');
//     await arrayToFileEv(fileNameWithExt, array);
//   } else {
//     const { arrayToFile: arrayToFileEv } = await import(/* @vite-ignore */ /* webpackIgnore: true */ './path.browser');
//     await arrayToFileEv(fileNameWithExt, array);
//   }
// }