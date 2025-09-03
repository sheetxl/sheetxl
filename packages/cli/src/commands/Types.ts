export type ModuleSDK = typeof import('@sheetxl/sdk');
export type ModuleIO = typeof import('@sheetxl/io');

export interface Modules {
  sdk: ModuleSDK;
  io: ModuleIO;
  [key: string]: any; // Allow for additional modules

  program: any; // The program instance from commander.js
}