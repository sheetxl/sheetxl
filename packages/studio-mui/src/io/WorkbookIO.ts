import type { IWorkbook } from '@sheetxl/sdk';

// Re-export all types from @sheetxl/io
// export type * from '@sheetxl/io';

// Import specific types we need locally
import type {
  IWorkbookIO, GetFormatsOptions, ReadWorkbookOptions, ReadFormatType, WriteFormatType, WriteWorkbookOptions,
  ReadWorkbookDetails
} from '@sheetxl/io';

import { IReactNotifier } from '@sheetxl/utils-react';

/**
 * Wraps the IO WorkbookIO class to provide lazy import and adds support for IReactNotifier
 * notification to the read method.
 *
 * @see '@sheetxl/io/IWorkbookIO'
 * @internal
 */
export class _WorkbookIO implements IWorkbookIO {

  protected _loadedIO: IWorkbookIO = null;

  protected async _loadIO(): Promise<IWorkbookIO> {
    let loadedIO = this._loadedIO;
    if (loadedIO) return loadedIO;

    try {
      const ioModule = await import(/* webpackChunkName: "io" */'@sheetxl/io');
      loadedIO = ioModule.WorkbookIO;
      this._loadedIO = loadedIO;
    } catch (error: any) {
      throw error;
    }
    return loadedIO;
  }

  /** @inheritdoc IWorkbookIO.getReadFormats */
  async getReadFormats(options?: GetFormatsOptions): Promise<ReadFormatType[]> {
    const loadedIO = await this._loadIO();
    return loadedIO.getReadFormats(options);
  }

  /** @inheritdoc IWorkbookIO.getWriteFormats */
  async getWriteFormats(options?: GetFormatsOptions): Promise<WriteFormatType[]> {
    const loadedIO = await this._loadIO();
    return loadedIO.getWriteFormats(options);
  }

  /** @inheritdoc IWorkbookIO.writeArrayBuffer */
  async writeArrayBuffer(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
    const loadedIO = await this._loadIO();
    return loadedIO.writeArrayBuffer(workbook, options);
  }

  /**
   * Override default IWorkbookIO to add notifier support.
   *
   * @param options {@link ReadWorkbookOptions}
   */
  async read(
    options: ReadWorkbookOptions,
    notifier?: IReactNotifier
  ): Promise<IWorkbook> {
    let hideBusyReading:any;
    let hideBusyOpening:any;
    try {
      hideBusyOpening = await notifier?.showBusy?.(`Opening${options.name ? ` ${options.name}` : ''}...`);
      const loadedIO = await this._loadIO();
      const retValue:IWorkbook = await loadedIO.read({
        ...options,
        progress: {
          async onStart(details: ReadWorkbookDetails): Promise<void> {
            await options?.progress?.onStart?.(details);
            hideBusyReading = await notifier?.showBusy?.(`Opening '${details.name}'...`);
          }
        }
      });
      hideBusyOpening?.();
      hideBusyReading?.();
      return retValue;
    } catch (error: any) {
      // before rethrow
      hideBusyOpening?.();
      hideBusyReading?.();
      throw error;
      // If the error is a string, we can assume it's
    }
  }

  /** @inheritdoc IWorkbookIO.writeFile */
  async writeFile(fileName: string | null, workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<boolean> {
    const loadedIO = await this._loadIO();
    return loadedIO.writeFile(fileName, workbook, options);
  }

  /** @inheritdoc IWorkbookIO.registerReadFormat */
  async registerReadFormat(format: ReadFormatType): Promise<void> {
    const loadedIO = await this._loadIO();
    return loadedIO.registerReadFormat(format);
  }

  /** @inheritdoc IWorkbookIO.registerWriteFormat */
  async registerWriteFormat(format: WriteFormatType): Promise<void> {
    const loadedIO = await this._loadIO();
    return loadedIO.registerWriteFormat(format);
  }

  /**
   * A string array of all the mimeTYpes. Used for the input accept attribute.
   *
   * @returns An array of strings for the input types.
   */
  async getAllReadFormatsAsString(): Promise<string> {
    const loadedIO = await this._loadIO();
    const types = await loadedIO.getReadFormats();
    const inputTypes:string[] = [];
    const typesLength = types.length;
    for (let i=0; i<typesLength; i++) {
      const type = types[i];
      const exts = type.exts;
      const extsLength = exts.length;
      // inputTypes.push(types[i].mimeType);
      for (let j=0; j<extsLength; j++) {
        inputTypes.push('.' + exts[j]);
      }
    }
    return inputTypes.join(', ');
  }

}

/**
 * A Singleton instance that lazy wraps '@sheetxl/io/WorkbookIO'.
 */
export const WorkbookIO = new _WorkbookIO();
