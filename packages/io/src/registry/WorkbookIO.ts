import { BufferUtils, type FetchArgs } from '@sheetxl/utils';

import { type IWorkbook, TextUtils } from '@sheetxl/sdk';

import type {
  WriteWorkbookOptions, ReadWorkbookOptions, WorkbookHandle, Base64Args, FormatType,
  WorkbookReadHandler, WorkbookWriteHandler, ReadFormatType, WriteFormatType
} from '../types';

import type { IWorkbookIO, GetFormatsOptions } from './IWorkbookIO';

import { BuiltinReadFormats } from './BuiltInReadFormats';
import { BuiltinWriteFormats } from './BuiltInWriteFormats';

import { arrayToFile } from '@sheetxl/io/lib/file';

/**
 * Default implementation of the {@link IWorkbookIO} interface.
 *
 * @hidden
 */
export class DefaultWorkbookIO implements IWorkbookIO {

  private _readFormats: readonly ReadFormatType[] = [];
  private _writeFormats: readonly WriteFormatType[] = [];

  constructor(
    readFormatTypes: ReadFormatType[]=BuiltinReadFormats,
    writeFormatTypes: WriteFormatType[]=BuiltinWriteFormats
  ) {
    // TODO - call register here
    this._readFormats = Object.freeze([...readFormatTypes]);
    this._writeFormats = Object.freeze([...writeFormatTypes]);
  }

  /** @inheritdoc IWorkbookIO.getReadFormats */
  async getReadFormats(options?: GetFormatsOptions): Promise<ReadFormatType[]> {
    if (!options) return [...this._readFormats];
    return this._filterFormats(options, this._readFormats);
  }

  /** @inheritdoc IWorkbookIO.getWriteFormats */
  async getWriteFormats(options?: GetFormatsOptions): Promise<WriteFormatType[]> {
    if (!this._writeFormats) return [];
    if (!options) return [...this._writeFormats];
    return this._filterFormats(options, this._writeFormats);
  }

  /** @inheritdoc IWorkbookIO.writeArrayBuffer */
  async writeArrayBuffer(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
    const writeType:WriteFormatType = (await this.getWriteFormats({ format: options?.format ?? 'slx' }))[0];
    return this._writeArrayBuffer(workbook, writeType, options);
  }

  /** @inheritdoc IWorkbookIO.read */
  async read(options: ReadWorkbookOptions): Promise<WorkbookHandle> {
    if (!options) {
      throw new Error(`'options' must be provided for read.`);
    }
    let source = options.source;
    if (!source) {
      throw new Error(`'options.source' must be provided for read.`);
    }
    const name = options.name;
    let format = options.format;
    let ext: string;
    if (!format && name) {
      ext = TextUtils.getFileNameExtension(name);
    }

    // convenience for readonly
    if (options.readonly !== undefined) {
      options = { ...options };
      options.createWorkbookOptions = {
        readonly: true,
        ...(options.createWorkbookOptions || {}),
      }
      delete options.readonly; // not needed but.
    }
    // if function resolve
    if (typeof source === 'function') {
      source = source();
    }
    // if promise resolve it.
    if (source && typeof source === 'object' && typeof (source as any).then === 'function') {
      source = await Promise.resolve(source);
    }

    const sourceType = this._detectImportSourceType(source as ReadWorkbookOptions | string);

    if (!sourceType) {
      throw new Error('Unable to detect source type from provided input.');
    }

    // Handle different source types by delegating to appropriate methods
    switch (sourceType) {
      case 'file': {
        const file = source as File;
        return await this._fromFile(file, options);
      }

      case 'base64': {
        let base64String: string;

        if (source && typeof source === 'object' && 'base64' in source) {
          // Handle Base64Args
          base64String = (source as Base64Args).base64;
        } else if (typeof source === 'string' && source.startsWith('data:')) {
          // Handle data URLs - extract base64 part
          const [, base64Part] = source.split(',');
          base64String = base64Part;
        } else {
          base64String = source as string;
        }

        const arrayBuffer = BufferUtils.base64ToArrayBuffer(base64String);
        const readType = (await this.getReadFormats({ format, ext }))[0];
        if (!readType) {
          throw new Error('No read type available for base64.');
        }

        const workbook:IWorkbook = await this._readArrayBuffer(arrayBuffer, readType, options);
        return {
          workbook,
          title: name || 'read-base64',
          format: readType
        };
      }
      case 'fetch': {
        let fetchInput: string | URL | Request = null;
        let fetchInit: RequestInit | undefined;
        let fetchTimeout: number;
        if (typeof source === 'string') {
          fetchInput = source;
        } else if (source && typeof source === 'object' && 'input' in source) {
          const fetchArgs = source as FetchArgs;
          fetchInput = fetchArgs.input;
          fetchInit = fetchArgs.init;
          fetchTimeout = fetchArgs.timeout;
        } else {
          throw new Error('Invalid fetch source provided.');
        }
        // Set up timeout using AbortController
        const timeoutMs = fetchTimeout || 30000; // Default 30 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Determine type from URL extension or provided type
        const fetchStr =  typeof fetchInput === 'string' ? fetchInput : fetchInput.toString();
        const extension = ext || TextUtils.getFileNameExtension(fetchStr);
        const readType = (await this.getReadFormats({ format, ext: extension }))[0];
        if (!readType) {
          throw new Error('No read type available for fetch.');
        }

        try {
          const response = await fetch(fetchInput, {
            ...fetchInit,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          if (!arrayBuffer) {
            throw new Error(`Unable to fetched content: ${fetchStr}`);
          }
          const workbook: IWorkbook = await this._readArrayBuffer(arrayBuffer, readType, options);

          return {
            workbook,
            title: name || TextUtils.getBaseName(fetchStr, true) || 'read-fetch',
            format: readType
          };
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error(`Fetch timeout after ${timeoutMs}ms: ${fetchStr}`);
          }
          throw error;
        }
      }

      case 'buffer': {
        const arrayBuffer: ArrayBufferLike  = source as ArrayBufferLike;
        const readType = (await this.getReadFormats({ format, ext }))[0];
        if (!readType) {
          throw new Error('No read type available for buffer.');
        }

        const workbook:IWorkbook = await this._readArrayBuffer(arrayBuffer, readType, options);
        return {
          workbook,
          title: name || 'read-buffer',
          format: readType
        };
      }

      case 'stream': {
        // For now, convert stream to array buffer
        // TODO: Implement proper streaming support in the future
        const stream = source as ReadableStream<Uint8Array>;
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
          }
        } finally {
          reader.releaseLock();
        }

        // Combine chunks into single ArrayBuffer
        const arrayBuffer = new ArrayBuffer(totalLength);
        const uint8Array = new Uint8Array(arrayBuffer);
        let offset = 0;
        for (const chunk of chunks) {
          uint8Array.set(chunk, offset);
          offset += chunk.length;
        }

        const readType = (await this.getReadFormats({ format, ext }))[0];
        if (!readType) {
          throw new Error('No read type available for stream.');
        }

        const workbook:IWorkbook = await this._readArrayBuffer(arrayBuffer, readType, options);
        return {
          workbook,
          title: name || 'read-stream',
          format: readType
        };
      }

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  /**
   * Write to the local file system attempting to use the fileName provided. This will
   * use the exportType to determine the export handler to use.
   *
   * @returns a Promise indicating success or failure.
   */
  // TODO - rationalize to just write
  async writeFile(fileName: string | null, workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<boolean> {
    if (!workbook || !fileName) {
      throw new Error('Workbook model or file name must be provided.');
    }
    if (!workbook.isIWorkbook) {
      throw new Error('Invalid workbook model provided. Must be an instance of IWorkbook.');
    }
    const fileExt = TextUtils.getFileNameExtension(fileName).toLowerCase();
    if (fileExt) {
      fileName = fileName.slice(0, fileName.length - fileExt.length - 1);
    }

    const writeType: WriteFormatType = (await this.getWriteFormats({ format: options?.format, ext: fileExt }))[0];
    if (!writeType) {
      throw new Error(`Unable to determine write type for '${fileName}'.`);
    }
    const fileNameWithExt = fileName + '.' + (fileExt || writeType.exts[0]);

    let array: ArrayBufferLike = null;
    try {
      array = await this._writeArrayBuffer(workbook, writeType, options);
    } catch (error: any) {
      if (typeof error === 'string')
        throw new Error(error);
      else
        throw error;
    }

    try {
      await arrayToFile(fileNameWithExt, array);
    } catch (error: any) {
      throw new Error(`Unable to write file.`, { cause: error });
    }
    return true;
  }

  /** @inheritdoc IWorkbookIO.registerReadFormat */
  async registerReadFormat(formatType: ReadFormatType): Promise<void> {
    this._registerFormatType(formatType, this._readFormats);
  }

  /** @inheritdoc IWorkbookIO.registerWriteFormat */
  async registerWriteFormat(formatType: WriteFormatType): Promise<void> {
    this._registerFormatType(formatType, this._writeFormats);
  }

  protected async _registerFormatType<T extends FormatType>(
    format: T,
    formats: readonly T[]
  ): Promise<void> {
    if (!format) {
      throw new Error('format must be provided.');
    }
    // TODO - add to list but ensure it the type is not already registered
  }

  /**
   * Detects the source type from the provided source value.
   * Returns the detected type or null if it cannot be determined.
   *
   * @internal
   */
  protected _detectImportSourceType(source: ReadWorkbookOptions | string): 'base64' | 'fetch' | 'buffer' | 'file' | 'stream' | 'auto' | null {
    // Handle Base64Args - explicit disambiguation
    if (source && typeof source === 'object' && 'base64' in source) {
      return 'base64';
    }

    // Handle FetchArgs objects (objects with url property)
    if (source && typeof source === 'object' && 'input' in source) {
      return 'fetch';
    }

    // Handle strings - now much simpler since base64 is explicitly wrapped
    if (typeof source === 'string') {
      // Data URLs
      if (source.startsWith('data:')) {
        return 'base64';
      }

      // HTTP/HTTPS URLs
      if (source.startsWith('http://') || source.startsWith('https://')) {
        return 'fetch';
      }

      // Relative URLs or absolute paths
      if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
        return 'fetch';
      }

      // All other strings are treated as URLs/paths (much safer default)
      return 'fetch';
    }

    // Handle File objects
    if (typeof File !== 'undefined' && source instanceof File) {
      return 'file';
    }

    // Handle ArrayBuffer and TypedArrays
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      return 'buffer';
    }

    // Handle ReadableStream
    if (typeof ReadableStream !== 'undefined' && source instanceof ReadableStream) {
      return 'stream';
    }

    return null;
  }

  /**
   * Returns a filtered array of formats using AND logic for all provided options.
   *
   * @remarks
   * - All filters are applied with AND logic (format must match ALL conditions)
   * - If ext is not provided, defaultExt is used as fallback
   * - Extension matching is case-insensitive and handles formats with/without leading dot
   * - Tag filtering requires ALL specified tags to be present
   *
   * @internal
   */
  protected _filterFormats<T extends FormatType>(
    options: GetFormatsOptions,
    formats: readonly T[],
    defaultExt?: string
  ): T[] {
    if (!options || Object.keys(options).length === 0) {
      if (!defaultExt) return [...formats];
      options = { ext: defaultExt };
    }

    const extFilter = options.ext || defaultExt;
    const normalizedExtFilter = extFilter ? extFilter.toLowerCase() : undefined;
    return formats.filter(format => {
      // Filter by extension (use defaultExt if ext not provided)
      if (normalizedExtFilter) {
        // Check if format has exts array (all FormatType have this)
        if ('exts' in format && Array.isArray(format.exts)) {
          const hasMatch = format.exts.some(ext => {
            const normalizedExt = ext.toLowerCase();
            return normalizedExt === normalizedExtFilter;
          });
          if (!hasMatch) return false;
        }
      }

      // Filter by MIME type (exact match, case-sensitive)
      if (options.mimeType !== undefined) {
        if (format.mimeType !== options.mimeType) return false;
      }

      // Filter by format key (exact match)
      if (options.format !== undefined) {
        if (format.key.toLocaleUpperCase() !== options.format.toLocaleUpperCase()) return false;
      }

      // Filter by isDefault flag
      if (options.isDefault !== undefined) {
        if (format.isDefault !== options.isDefault) return false;
      }

      // Filter by tags (format must have ALL specified tags)
      if (options.tags) {
        const formatTags = format.tags || [];
        // Handle both string and array of strings for tags option
        const requiredTags = typeof options.tags === 'string' ? [options.tags] : options.tags;
        const hasAllTags = requiredTags.every(tag => formatTags.includes(tag));
        if (!hasAllTags) return false;
      }

      // If all filters passed, include this format
      return true;
    }) as T[];
  }

  protected async _fromFile(file: File, options: ReadWorkbookOptions=null): Promise<WorkbookHandle> {
    let retValue: WorkbookHandle = null;
    try {
      let fileDisplay:string = '';
      if (file?.name) {
        fileDisplay = `${TextUtils.getBaseName(file.name)}`;
      }
      const readType = (await this.getReadFormats({ format: options?.format, ext: TextUtils.getFileNameExtension(file?.name) }))[0];
      if (!readType) {
        throw new Error(`Unknown file type: ${TextUtils.getFileNameExtension(file?.name) ?? file?.name ?? '(empty)'}.`);
      }

      const buffer: ArrayBuffer = await file.arrayBuffer();
      // const array:ArrayBufferLike = new Uint8Array(buffer).buffer;
      const optionsTyped: ReadWorkbookOptions = {
        name: fileDisplay,
        ...options,
        ...options?.typedCreateWorkbookOptions?.[readType.key]
      }
      delete optionsTyped.typedCreateWorkbookOptions;

      const handlerRead:WorkbookReadHandler = readType.handler;

      const workbook: IWorkbook = await handlerRead(buffer, optionsTyped);
      retValue = new WorkbookFileHandle(file, workbook, fileDisplay, readType);
    } catch (error: any) {
      throw error;
    };
    return retValue;
  }

  protected async _writeArrayBuffer(workbook: IWorkbook, writeType: WriteFormatType, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
    if (!writeType) {
      throw new Error(`Invalid write type for '${writeType}'.`);
    }
    try {
      const handlerWrite: WorkbookWriteHandler = writeType.handler;
      if (!handlerWrite) {
        throw new Error(`Unable to resolve handler for type: ${writeType.description ?? writeType}.`);
      }
      return handlerWrite(workbook, options);
    } catch (error: any) {
      throw new Error(`Unable to load handler for '${writeType}.'`, { cause: error });
    }
  }

  protected async _readArrayBuffer(arrayBuffer: ArrayBufferLike, format: ReadFormatType, options: ReadWorkbookOptions=null): Promise<IWorkbook> {
    if (!arrayBuffer)
      throw new Error(`ArrayBuffer must be specified.`);
    if (!format) {
      throw new Error(`format must be specified.`);
    }

    const handlerRead:WorkbookReadHandler = format.handler as WorkbookReadHandler;
    if (!handlerRead) {
      throw new Error(`Unable to resolve handler for format type: ${format?.description ?? format}.`);
    }

    const optionsTyped = {
      ...options,
      ...options?.typedCreateWorkbookOptions?.[format.key]
    }
    delete optionsTyped.typedCreateWorkbookOptions;
    let workbook: IWorkbook;
    try {
      workbook = await handlerRead(arrayBuffer, optionsTyped)
    } catch (error: any) {
      throw new Error(`Unable to read`, { cause: error });
    }
    return workbook;
  }

}

class WorkbookFileHandle implements WorkbookHandle {
  file: File;
  workbook: IWorkbook;
  title: string;
  format: ReadFormatType;

  constructor(file: File, workbook: IWorkbook, title: string, format: ReadFormatType) {
    this.file = file;
    this.workbook = workbook;
    this.title = title;
    this.format = format;
  }

  get [Symbol.toStringTag](): string {
    return '[WorkbookHandle]';
  }

  toString(): string {
    return `'${this.file.name}' ${this.file.size} (${this.format.description})`;
  }
}

/**
 * A singleton instance of the default {@link IWorkbookIO} implementation.
 */
export const WorkbookIO: IWorkbookIO = new DefaultWorkbookIO();
