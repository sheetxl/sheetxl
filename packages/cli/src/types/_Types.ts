import { type Command } from 'commander';

import { type ModuleSDK, type ModuleIO } from './Types';

export interface Modules {
  sdk: ModuleSDK;
  io: ModuleIO;

  program: Command;

  [key: string]: any; // Allow for additional modules
}