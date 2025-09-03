import { BufferUtils, type FetchArgs } from '@sheetxl/utils';

import { type IWorkbook, TextUtils } from '@sheetxl/sdk';

import type {
  WriteWorkbookOptions, ReadWorkbookOptions, WorkbookHandle, Base64Args,
  WorkbookFromHandler, WorkbookToHandler, ReadFormatType, WriteFormatType
} from '../types';

import { DefaultReadTypes } from './ReadTypes';
import { DefaultWriteTypes } from './WriteTypes';

import { arrayToFile } from '@sheetxl/io/lib/file';

export class DefaultWorkbookIO {

  private _readFormatTypes: readonly ReadFormatType[] = [];
  private _writeFormatType: readonly WriteFormatType[] = [];

  constructor(
    readFormatTypes: ReadFormatType[]=DefaultReadTypes,
    writeFormatType: WriteFormatType[]=DefaultWriteTypes
  ) {
    this._readFormatTypes = Object.freeze([...readFormatTypes]);
    this._writeFormatType = Object.freeze([...writeFormatType]);
  }

  /**
   * Detects the source type from the provided source value.
   * Returns the detected type or null if it cannot be determined.
   */
  private _detectImportSourceType(source: ReadWorkbookOptions | string): 'base64' | 'fetch' | 'buffer' | 'file' | 'stream' | 'auto' | null {
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

  // add
  // remove

  getReadFormats(): readonly ReadFormatType[] {
    return this._readFormatTypes;
  }

  getWriteFormats(): readonly WriteFormatType[] {
    return this._writeFormatType;
  }

  getReadFormatTypeForKey(key: string): ReadFormatType | null {
    return this._readFormatTypes.find((type) => type.key.includes(key)) ?? null;
  }

  getReadFormatTypeForExt(ext: string): ReadFormatType | null {
    ext = ext.toLowerCase();
    return this._readFormatTypes.find((type) => type.exts.includes(ext)) ?? null;
  }

  getReadFormatTypeForMimeType(mimeType: string): ReadFormatType | null {
    return this._readFormatTypes.find((type) => type.mimeType === mimeType) ?? null;
  }

  getWriteFormatTypeForExt(ext: string): WriteFormatType | null {
    ext = ext.toLowerCase();
    return this._writeFormatType.find((type) => type.ext === ext) ?? null;
  }

  getWriteFormatType(text: string): WriteFormatType | null {
    text = text.toLowerCase();
    let type:WriteFormatType =  this._writeFormatType.find((type) => type.ext === text) ?? null;
    if (type) return type;
    type = this._writeFormatType.find((type) => type.key.toLowerCase() === text) ?? null;
    if (type) return type;
    return this._writeFormatType.find((type) => type.mimeType.toLowerCase() === text) ?? null;
  }

  /**
   * A string array of all the mimeTYpes. Used for the input accept attribute.
   * @returns - An array of strings for the input types.
   */
  getAllReadFormatTypeAsString(): string[] {
    const inputTypes:string[] = [];
    for (let i=0; i<this._readFormatTypes.length; i++) {
      inputTypes.push(this._readFormatTypes[i].mimeType);
    }
    return inputTypes;
  }

  async toArrayBuffer(workbook: IWorkbook, key: string, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
    const exportType:WriteFormatType = this.getWriteFormatType(key);
    if (!exportType) {
      throw new Error(`Invalid export type for '${key}'.`);
    }
    try {
      const handlerExport: WorkbookToHandler = exportType.handler;
      if (!handlerExport) {
        throw new Error(`Unable to resolve handler for type: ${exportType.description ?? key}.`);
      }
      return handlerExport(workbook, options);
    } catch (error: any) {
      throw new Error(`Unable to load handler for '${key}.'`, { cause: error });
    }
  }

  protected async _fromArrayBuffer(arrayBuffer: ArrayBufferLike, formatKey: string, options: ReadWorkbookOptions=null): Promise<IWorkbook> {
    let importType:ReadFormatType = this.getReadFormatTypeForKey(formatKey) ?? this.getReadFormatTypeForExt(formatKey) ?? this.getReadFormatTypeForMimeType(formatKey);
    if (!arrayBuffer || !importType) {
      if (!arrayBuffer)
        throw new Error(`ArrayBuffer must be specified.`);
      else if (!formatKey)
        throw new Error(`formatKey must be specified.`);
      // else if (!key)
      //   throw new Error(`Unable to resolve key: '${key}'.`);
    }

    const handlerImport:WorkbookFromHandler = importType.handler as WorkbookFromHandler;
    if (!handlerImport) {
      throw new Error(`Unable to resolve handler for type: ${importType?.description ?? formatKey}.`);
    }

    const optionsTyped = {
      ...options,
      ...options?.typedCreateWorkbookOptions?.[formatKey]
    }
    delete optionsTyped.typedCreateWorkbookOptions;
    let workbook: IWorkbook;
    try {
      workbook = await handlerImport(arrayBuffer, optionsTyped)
    } catch (error: any) {
      throw new Error(`Unable to import`, { cause: error });
    }
    return workbook;
  }

  /**
   * Imports a workbook from various source types with automatic detection.
   *
   * This method provides a unified interface for importing workbooks from different
   * source types including files, base64 strings, fetch URLs, array buffers, and streams.
   * The source type is automatically detected based on the input value.
   *
   * @param options - Optional import configuration and callbacks
   *
   * @returns A promise that resolves to ImportResults containing the workbook, filename, and detected type
   *
   * @throws {Error} When the source type cannot be detected
   * @throws {Error} When no appropriate import handler is available
   * @throws {Error} When the import operation fails
   *
   * @remarks
   * Source type detection rules:
   * - Objects with `base64` property → base64 type
   * - Objects with `input` property → fetch type (FetchArgs)
   * - Strings starting with `data:` → base64 type
   * - Strings starting with `http://` or `https://` → fetch type
   * - Strings starting with `/`, `./`, `../` → fetch type
   * - Other strings → fetch type (default)
   * - File objects → file type
   * - ArrayBuffer/TypedArrays → buffer type
   * - ReadableStream → stream type (converted to buffer)
   * - Functions → resolved then re-detected
   * - Promises → resolved then re-detected
   */
  async read(options: ReadWorkbookOptions): Promise<WorkbookHandle> {
    if (!options) {
      throw new Error(`'options' must be provided for load.`);
    }
    let source = options.source;
    if (!source) {
      throw new Error(`'options.source' must be provided for load.`);
    }
    const name = options.name;
    const type = options.formatType;

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
        const importType = this.getReadFormatTypeForExt(type) || this._readFormatTypes[0]; // fallback to first type

        if (!importType) {
          throw new Error('No import type available for base64 input.');
        }

        const workbook:IWorkbook = await this._fromArrayBuffer(arrayBuffer, importType.key, options);
        return {
          workbook,
          title: name || 'imported-file',
          formatType: importType
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
        const extension = type || TextUtils.getFileNameExtension(fetchStr);
        const formatType = this.getReadFormatTypeForExt(extension) || this._readFormatTypes[0];

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
          if (!formatType) {
            throw new Error(`Unable to determine import type for fetched content: ${fetchStr}`);
          }
          const workbook: IWorkbook = await this._fromArrayBuffer(arrayBuffer, formatType.key, options);

          return {
            workbook,
            title: name || TextUtils.getBaseName(fetchStr, true) || 'fetched-file',
            formatType
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
        const formatType = this.getReadFormatTypeForExt(type) || this._readFormatTypes[0];

        if (!formatType) {
          throw new Error('No import type available for buffer input.');
        }

        const workbook:IWorkbook = await this._fromArrayBuffer(arrayBuffer, formatType.key, options);
        return {
          workbook,
          title: name || 'buffer-file',
          formatType
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

        const formatType = this.getReadFormatTypeForExt(type) || this._readFormatTypes[0];
        if (!formatType) {
          throw new Error('No import type available for stream input.');
        }

        const workbook:IWorkbook = await this._fromArrayBuffer(arrayBuffer, formatType.key, options);
        return {
          workbook,
          title: name || 'stream-file',
          formatType
        };
      }

      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  protected async _fromFile(file: File, options: ReadWorkbookOptions=null): Promise<WorkbookHandle> {
    let retValue: WorkbookHandle = null;
    try {
      let fileDisplay:string = '';
      if (file?.name) {
        fileDisplay = `${TextUtils.getBaseName(file.name)}`;
      }
      const formatType:ReadFormatType = this.getReadFormatTypeForExt(TextUtils.getFileNameExtension(file?.name));
      if (!formatType) {
        throw new Error(`Unknown file type: ${TextUtils.getFileNameExtension(file?.name) ?? file?.name ?? '(empty)'}.`);
      }

      const buffer: ArrayBuffer = await file.arrayBuffer();
      // const array:ArrayBufferLike = new Uint8Array(buffer).buffer;
      const optionsTyped: ReadWorkbookOptions = {
        ...options,
        ...options?.typedCreateWorkbookOptions?.[formatType.key]
      }
      delete optionsTyped.typedCreateWorkbookOptions;

      const handlerImport:WorkbookFromHandler = formatType.handler;
      if (!handlerImport) {
        throw new Error(`Unable to resolve handler for type: ${formatType?.description ?? TextUtils.getFileNameExtension(file?.name) ?? file?.name ?? '(empty)'}.`);
      }

      await optionsTyped.onStart?.(fileDisplay);
      const workbook: IWorkbook = await handlerImport(buffer, optionsTyped);
      retValue = new WorkbookFileHandle(file, workbook, fileDisplay, formatType);
    } catch (error: any) {
      throw error;
    };
    return retValue;
  }

  /**
   * Exports to the local file system attempting to use the fileName provided. This will
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
    const fileExt = TextUtils.getFileNameExtension(fileName);
    if (fileExt) {
      fileName = fileName.slice(0, fileName.length - fileExt.length - 1);
    }

    let exportType: WriteFormatType = null;
    if (options?.formatType) {
      exportType = this.getWriteFormatType(options.formatType);
    }

    const writeFormatTypes = this.getWriteFormats();
    const writeFormatTypesLength = writeFormatTypes.length;
    for (let i=0; !exportType && i<writeFormatTypesLength; i++) {
      if (writeFormatTypes[i].ext === fileExt || (!fileExt && writeFormatTypes[i].isDefault)) {
        exportType = writeFormatTypes[i];
      }
    }

    if (!exportType) {
      throw new Error(`Unable to determine export type for '${fileName}'.`);
    }
    const fileNameWithExt = fileName + '.' + exportType.ext;

    let array: ArrayBufferLike = null;
    try {
      array = await this.toArrayBuffer(workbook, exportType.key);
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
}

class WorkbookFileHandle implements WorkbookHandle {
  file: File;
  workbook: IWorkbook;
  title: string;
  formatType: ReadFormatType;

  constructor(file: File, workbook: IWorkbook, title: string, formatType: ReadFormatType) {
    this.file = file;
    this.workbook = workbook;
    this.title = title;
    this.formatType = formatType;
  }

  get [Symbol.toStringTag](): string {
    return '[WorkbookHandle]';
  }

  toString(): string {
    return `'${this.file.name}' ${this.file.size} (${this.formatType.description})`;
  }
}

export const WorkbookIO = new DefaultWorkbookIO();
