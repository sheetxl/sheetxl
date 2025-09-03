import { ReadWorkbookOptions, WriteWorkbookOptions } from '../../types';

export interface WriteXLSXOptions extends WriteWorkbookOptions {
  password?: string;
}

export interface ReadXLSXOptions extends ReadWorkbookOptions {
  password?: string;
}
