import type { IWorkbook } from '@sheetxl/sdk';

import type { FetchArgs, TaskProgress } from '@sheetxl/utils';

/**
 * Wrapper object to explicitly indicate base64 string content.
 *
 * Use this interface to disambiguate base64 strings from URLs when
 * the automatic detection might be ambiguous.
 *
 * @example
 * ```typescript
 * // Explicit base64 (no ambiguity)
 * const source: ImportSource = {
 *   source: { base64: 'iVBORw0KGgoAAAANSUhEUgAAA...' },
 *   type: 'png'
 * };
 * ```
 */
export interface Base64Args {
  /**
   * The base64 encoded string content.
   */
  base64: string;
}

/**
 * Union type representing all possible io source types.
 *
 * @remarks
 * This type encompasses all the different ways data can be provided
 * for import operations, from simple strings to complex stream objects.
 */
export type IOSource = string | File | Blob | ArrayBufferLike | ReadableStream<Uint8Array> | FetchArgs | Base64Args;

/**
 * Union type representing all possible input sources for workbook imports.
 *
 * @remarks
 * This type is used to define the source of data for importing workbooks,
 * allowing for various formats such as URLs, files, and raw binary data.
 */
export interface FormatType {
  /**
   * The key used to identify the type of import.
   *
   * @remarks
   * Must be unique across all format types.
   */
  key: string;
  /**
   * A description of the type of import.
   */
  description?: string;
  /**
   * The mime type of the import.
   */
  mimeType: string;
  /**
   * Tags that are used by the UI.
   */
  tags?: string[];
  /**
   * Indicates if this is the default import type.
   *
   * @defaultValue false
   *
   * @remarks
   * For import the default doesn't have any significance other than an indicator for the UI.
   */
  isDefault?: boolean;
  /**
   * The file extensions that this type of supports.
   */
  exts: string[];
}

/*
 * Define here and in io because we want lazy loading
 */
export interface ReadFormatType extends FormatType {
  /**
   * The handler function for importing a workbook from this format.
   */
  handler: WorkbookReadHandler;
}

/**
 * Defines the format type for saving a workbook.
 *
 * @remarks
 * This interface extends {@link FormatType} to include additional properties
 * specific to saving formats, such as file extension and export handler.
 */
export interface WriteFormatType extends FormatType {
  /**
   * The handler function for importing a workbook from this format.
   */
  handler: WorkbookWriteHandler;
};

/**
 * Details about a workbook operation.
 */
export interface IOWorkbookDetails {
  /**
   * The format type of Workbook detected.
   */
  format: FormatType;

  /**
   * The name of the workbook, if available.
   *
   * @remarks
   * This can be null if no name was provided or could not be determined.
   */
  name: string | null;
}

/**
 * Details about a read workbook operation.
 */
export interface ReadWorkbookDetails extends IOWorkbookDetails {
  /**
   * The format type of Workbook detected.
   */
  format: ReadFormatType;
}

/**
 * Details about a write workbook operation.
 */
export interface WriteWorkbookDetails extends IOWorkbookDetails {
  /**
   * The format type of Workbook detected.
   */
  format: WriteFormatType;
}

/**
 * Options for reading and creating a workbook from various sources.
 */
export interface ReadWorkbookOptions {
  /**
   * The io source for reading. Can be a direct value, Promise, or function.
   */
  source: IOSource | Promise<IOSource> | (() => IOSource | Promise<IOSource>);

  /**
   * Indicate the the workbook should be read-only.
   *
   * @remarks
   * This is a shortcut to createWorkbookOptions.readonly = true
   * If it is set in the createWorkbookOptions it will override this value.
   */
  readonly?: boolean;

  /**
   * Provide options to the workbook constructor.
   */
  createWorkbookOptions?: IWorkbook.ConstructorOptions;

  /**
   * Optional file type hint (extension, MIME type, or import key).
   *
   * Used for type detection when it cannot be inferred from the source.
   * Examples: 'xlsx', 'csv', 'application/json', 'Excel'
   */
  format?: string;

  /**
   * Optional human-readable name for the import.
   *
   * Used as a fallback filename and for display purposes.
   * If not provided, a default name will be generated based on the source.
   */
  name?: string;

  /**
   * Optional progress callback for long running imports.
   */
  progress?: TaskProgress<ReadWorkbookDetails>;

  /**
   * Allows for different constructor arguments depending on the type of format detected.
   *
   * @remarks
   * This will overwrite the options with the createWorkbookOptions provided.
   */
  typedCreateWorkbookOptions?: Record<string, IWorkbook.ConstructorOptions>;
};

/**
 * Options for writing and exporting a workbook to various destinations.
 */
export interface WriteWorkbookOptions {
  /**
   * The destination for writing the workbook.
   *
   * Can be a string (file path), File, Blob, or a function returning these types.
   */
  // destination: string | File | Blob | (() => string | File | Blob);

  /**
   * Optional file type hint (extension, MIME type, or export key).
   *
   * Used for type detection when it cannot be inferred from the destination.
   * Examples: 'xlsx', 'csv', 'application/json', 'Excel'
   */
  format?: string;

  /**
   * Optional progress callback for long running imports.
   */
  progress?: TaskProgress<WriteWorkbookDetails>;
}

/**
 * For reading from an array into an IWorkbook.
 *
 * @param arrayBuffer The array buffer containing the workbook data.
 * @param options Optional options for loading the workbook, such as format type and workbook options.
 * @returns A promise that resolves to an IWorkbook instance.
 */
// TODO - Make Stream
export type WorkbookReadHandler = (
  arrayBuffer: ArrayBufferLike,
  options?: Omit<ReadWorkbookOptions, 'source'>
) => Promise<IWorkbook>;

/**
 * Export for writing to an array from an IWorkbook
 *
 * @param workbook The workbook instance to export.
 * @param options Optional options for saving the workbook, such as compression and whitespace formatting.
 * @returns A promise that resolves to an array buffer representing the workbook
 */
// TODO - Make Stream
export type WorkbookWriteHandler = (
  workbook: IWorkbook,
  options?: Omit<WriteWorkbookOptions, 'source'>
) => Promise<ArrayBufferLike>;
