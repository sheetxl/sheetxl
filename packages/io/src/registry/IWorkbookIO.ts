import type {
  ReadWorkbookOptions, WriteWorkbookOptions, ReadFormatType, WriteFormatType
 } from '../types';

import { type IWorkbook } from '@sheetxl/sdk';

/**
 * Interface for workbook input/output operations across multiple source types and formats.
 *
 * @remarks
 * This interface provides a flexible I/O system with **two independent dimensions**:
 *
 * ### **Source Type** (Where/How data is stored)
 * The physical location or container of the workbook data:
 * - **File**: Local file system files (`File` objects)
 * - **Blob**: Binary data blobs (from canvas, clipboard, etc.)
 * - **URL/Fetch**: Remote resources fetched via HTTP/HTTPS
 * - **ArrayBuffer**: Raw binary data in memory
 * - **Base64**: Base64-encoded strings
 * - **Stream**: Streaming data (`ReadableStream`)
 *
 * ### **Format Type** (How data is encoded)
 * The encoding/file format of the workbook data:
 * - **sxl**: SheetXL format
 * - **xlsx**: Excel 2007+ format (Office Open XML)
 * - **csv**: Comma-separated values
 * - **xml**: Excel 2003 XML format
 * - And other registered formats
 *
 * ### How They Work Together
 * Any **source type** can contain any **format type**. For example:
 * - A `File` could contain `sxl`, `xlsx`, `csv` data
 * - A `URL` could point to an `sxl`, `xlsx`, or `csv` file
 * - An `ArrayBuffer` could hold `sxl`, `xlsx`, or `csv` data
 *
 * The system automatically detects the format type from:
 * - File extensions (`.xlsx`, `.csv`, etc.)
 * - MIME types (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
 * - Content sniffing (examining the actual data)
 *
 * @example
 * ```typescript
 * // Example 1: File source with xlsx format
 * const wb: IWorkbook = await WorkbookIO.read({ source: fileObject }); // Auto-detects .xlsx
 *
 * // Example 2: URL source with csv format
 * const wb: IWorkbook = await WorkbookIO.read({ source: 'https://example.com/data.csv' });
 *
 * // Example 3: ArrayBuffer source with explicit format
 * const wb: IWorkbook = await WorkbookIO.read({
 *   source: arrayBuffer,
 *   format: 'xlsx' // Format can't be auto-detected or forced
 * });
 *
 * // Example 4: ArrayBuffer source with sxl format
 * const wb: IWorkbook = await WorkbookIO.read({
 *   source: arrayBuffer,
 *   format: 'sxl' // Format can't be auto-detected or forced
 * });
 * ```
 */
export interface IWorkbookIO {
  /**
   * Reads a workbook from any source type with automatic format detection.
   *
   * @param options - Configuration specifying the source and optional format.
   *
   * @returns A promise resolving to a {@link IWorkbook}.
   *
   * @throws {Error} When the source type cannot be detected or accessed
   * @throws {Error} When no appropriate format handler is available for the detected format
   * @throws {Error} When the read operation fails (corrupt file, network error, etc.)
   *
   * @remarks
   * ## Source Type Automatic-Detection
   * The method automatically determines the **source type** (where data comes from):
   *
   * | Input Pattern | Detected Source Type | Example |
   * |--------------|---------------------|---------|
   * | `{ base64: "..." }` | Base64 string | `{ base64: "iVBORw0K..." }` |
   * | `{ input: "..." }` | Fetch/URL | `{ input: "https://api.example.com" }` |
   * | String starting with `data:` | Base64 data URI | `"data:application/json;base64,..."` |
   * | String starting with `http://` or `https://` | Remote URL | `"https://example.com/file.xlsx"` |
   * | String starting with `/`, `./`, `../` | Relative/absolute path | `"./data/workbook.csv"` |
   * | Other strings | Treated as URL/path | `"workbook.xlsx"` |
   * | `File` object | Browser File API | `<input type="file">` result |
   * | `Blob` object | Binary data blob | Canvas, clipboard, etc. |
   * | `ArrayBuffer` or TypedArray | Binary buffer | Raw bytes in memory |
   * | `ReadableStream` | Streaming data | Converted to buffer first |
   * | `Promise<T>` | Async source | Resolved, then re-detected |
   * | `() => T` | Lazy source | Invoked, then re-detected |
   *
   * ## Format Type Automatic-Detection
   * The method automatically determines the **format type** (how data is encoded):
   * 1. **File extension** from source name (`.sxl`, `.xlsx`, `.csv`)
   * 2. **MIME type** from HTTP response headers
   * 3. **Content inspection** by examining magic bytes/signatures
   * 4. **Explicit format** via `options.format`
   *
   * @example
   * ```typescript
   * // Auto-detect everything from a File object
   * const wb: IWorkbook = await WorkbookIO.read({ source: fileInput.files[0] });
   *
   * // Fetch from URL (auto-detects format from extension or Content-Type)
   * const wb: IWorkbook = await WorkbookIO.read({
   *   source: 'https://example.com/spreadsheet.xlsx'
   * });
   *
   * // SheetXL formatted workbook
   * const wb: IWorkbook = await WorkbookIO.read({
   *   source: sxlArrayBuffer,
   *   format: 'sxl'
   * });
   *
   * // ArrayBuffer with explicit format
   * const wb: IWorkbook = await WorkbookIO.read({
   *   source: arrayBuffer,
   *   format: 'xlsx', // Format can't be auto-detected or forced
   *   name: 'My Workbook' // Optional display name
   * });
   *
   * // Lazy loading with progress callback
   * const wb: IWorkbook = await WorkbookIO.read({
   *   source: async () => await fetch('/api/workbook').then(r => r.arrayBuffer()),
   *   progress: (amount) => console.log(`${amount}%:`)
   * });
   * ```
   */
  read(options: ReadWorkbookOptions): Promise<IWorkbook>;

  /**
   * Writes a workbook to an ArrayBuffer in the specified format.
   *
   * @param workbook - The workbook instance to write
   * @param options - Write configuration including format type and encoding options
   *
   * @returns A promise resolving to an ArrayBuffer containing the encoded workbook data
   *
   * @remarks
   * This method produces raw binary data in the **format type** you specify (sxl, xlsx, csv, etc.).
   * The **source type** is always ArrayBuffer - use this for:
   * - In-memory operations
   * - Custom upload logic
   * - Further processing before saving
   *
   * ## Format Type Auto-Detection
   * - Specify via `options.format` (e.g., `'sxl'`, `'xlsx'`, `'csv'`)
   * - If not provided, defaults to the first registered write format
   *
   * @example
   * ```typescript
   * // Write as Excel format
   * const buffer: ArrayBufferLike = await workbookIO.writeArrayBuffer(workbook, {
   *   format: 'xlsx'
   * });
   *
   * // Write as CSV
   * const csvBuffer: ArrayBufferLike = await workbookIO.writeArrayBuffer(workbook, {
   *   format: 'csv'
   * });
   *
   * // Upload to server
   * const buffer: ArrayBufferLike = await workbookIO.writeArrayBuffer(workbook, { format: 'xlsx' });
   * await fetch('/api/upload', {
   *   method: 'POST',
   *   body: buffer
   * });
   * ```
   */
  writeArrayBuffer(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike>;

  /**
   * Writes a workbook to the local file system or triggers a download.
   *
   * @param fileName - Desired filename (with extension) or `null` to prompt user
   * @param workbook - The workbook instance to write
   * @param options - Write configuration (format type is auto-detected from extension if not specified)
   *
   * @returns A promise resolving to `true` on success, `false` on failure
   *
   * @remarks
   * The behavior of the this varies by environment:
   *
   * | Environment | Source Type Destination | Behavior |
   * |-------------|------------------------|----------|
   * | **Node.js** | File system | Uses `fs` module to write file directly |
   * | **Modern Browser** | File System Access API | Prompts user for save location (Chrome 86+) |
   * | **Older/Mobile Browser** | Download | Triggers browser download to default location |
   *
   * ### **Format Type** Auto-Detection
   * If `options.format` is not provided, it's automatically inferred from the file extension:
   * - `"report.sxl"` → sxl format
   * - `"report.xlsx"` → xlsx format
   * - `"data.csv"` → csv format
   *
   * @example
   * ```typescript
   * // Auto-detect format from extension
   * const success: boolean = await workbookIO.writeFile('report.xlsx', workbook);
   *
   * // Explicit format type (overrides extension detection)
   * const success: boolean = await workbookIO.writeFile('export.dat', workbook, {
   *   format: 'xlsx'
   * });
   *
   * // Prompt user for filename (modern browsers only)
   * const success: boolean = await workbookIO.writeFile(null, workbook, {
   *   format: 'csv'
   * });
   *
   * // With additional options
   * const success: boolean = await workbookIO.writeFile('compressed.xlsx', workbook, {
   *   format: 'xlsx',
   *   compression: true
   * });
   * ```
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API | File System Access API}
   */
  // TODO - rationalize to just write
  writeFile(fileName: string | null, workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<boolean>;

  /**
   * Returns available read format types (encoding formats that can be read).
   *
   * @param options - Optional filters to narrow down the format types
   * @returns Array of format type definitions that can decode workbook data
   *
   * @remarks
   * Returns **format types** (encoding formats like sxl, xlsx, csv), not source types.
   * Each format type includes:
   * - File extensions it supports (e.g., `['.xlsx', '.xlsm']`)
   * - MIME type (e.g., `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`)
   * - Handler function for decoding that format
   *
   * These format types work with **any source type** (File, URL, ArrayBuffer, etc.).
   *
   * @example
   * ```typescript
   * // Get all available read formats
   * const allFormats = workbookIO.getReadFormats();
   * console.log(allFormats.map(f => f.key)); // ['sxl', 'xlsx', 'csv', ...]
   *
   * // Find format by file extension
   * const csvFormat = workbookIO.getReadFormats({ ext: '.csv' });
   *
   * // Find format by MIME type
   * const xlsxFormat = workbookIO.getReadFormats({
   *   mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   * });
   *
   * // Get only default formats (for UI display)
   * const defaultFormats = workbookIO.getReadFormats({ isDefault: true });
   * ```
   */
  getReadFormats(options?: GetFormatsOptions): Promise<ReadFormatType[]>;

  /**
   * Returns available write format types (encoding formats that can be written).
   *
   * @param options - Optional filters to narrow down the format types
   * @returns Array of format type definitions that can encode workbook data
   *
   * @remarks
   * Returns **format types** (encoding formats like sxl, xlsx, csv), not source types.
   * Each format type includes:
   * - File extension it produces (e.g., `'.xlsx'`)
   * - MIME type (e.g., `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`)
   * - Handler function for encoding that format
   *
   * The encoded data can then be written to **any source type** (File, ArrayBuffer, etc.).
   *
   * @example
   * ```typescript
   * // Get all available write formats
   * const allFormats = workbookIO.getWriteFormats();
   * console.log(allFormats.map(f => f.key)); // ['sxl', 'xlsx', 'csv', ...]
   *
   * // Find format by extension
   * const xlsxFormat = workbookIO.getWriteFormats({ ext: '.xlsx' });
   *
   * // Build a file type picker for UI
   * const formats = workbookIO.getWriteFormats();
   * const fileTypes = formats.map(f => ({
   *   description: f.description,
   *   accept: { [f.mimeType]: [f.ext] }
   * }));
   * ```
   */
  getWriteFormats(options?: GetFormatsOptions): Promise<WriteFormatType[]>;

  /**
   * Registers a new read format type or replaces an existing one.
   *
   * @param format - The format type definition containing decoder logic
   *
   * @remarks
   * Use this to add support for new workbook encoding formats (not source types).
   * If a format with the same `key` already exists, it will be replaced.
   *
   * This allows you to:
   * - Add custom format types (e.g., proprietary formats)
   * - Override built-in format handlers
   * - Extend format support for your application
   *
   * The registered format will work with **all source types** automatically.
   *
   * @example
   * ```typescript
   * // Register a custom XML-based format
   * workbookIO.registerReadFormat({
   *   key: 'custom-xml',
   *   description: 'Custom XML Workbook Format',
   *   mimeType: 'application/x-custom-workbook+xml',
   *   exts: ['.cwb', '.cxml'],
   *   tags: ['xml', 'custom'],
   *   isDefault: false,
   *   handler: async (buffer, options) => {
   *     // Decode buffer into IWorkbook
   *     const xmlString = new TextDecoder().decode(buffer);
   *     return parseCustomXML(xmlString);
   *   }
   * });
   *
   * // Now any source type can use this format
   * await workbookIO.read({ source: 'data.cwb' }); // Auto-detected
   * await workbookIO.read({ source: fileObject, format: 'custom-xml' });
   * ```
   */
  registerReadFormat(format: ReadFormatType): Promise<void>;

  /**
   * Registers a new write format type or replaces an existing one.
   *
   * @param format - The format type definition containing encoder logic
   *
   * @remarks
   * Use this to add support for new workbook encoding formats (not source types).
   * If a format with the same `key` already exists, it will be replaced.
   *
   * This allows you to:
   * - Add custom format types (e.g., proprietary formats)
   * - Override built-in format handlers
   * - Extend format support for your application
   *
   * The registered format can then be written to **any source type** (File, ArrayBuffer, etc.).
   *
   * @example
   * ```typescript
   * // Register a custom JSON-based format
   * workbookIO.registerWriteFormat({
   *   key: 'custom-json',
   *   description: 'Custom JSON Workbook Format',
   *   mimeType: 'application/json',
   *   ext: '.cjson',
   *   tags: ['json', 'custom'],
   *   isDefault: false,
   *   handler: async (workbook, options) => {
   *     // Encode workbook into ArrayBuffer
   *     const jsonString = JSON.stringify(customSerialize(workbook));
   *     return new TextEncoder().encode(jsonString).buffer;
   *   }
   * });
   *
   * // Use with any write method
   * await workbookIO.writeFile('report.cjson', workbook);
   * const buffer = await workbookIO.writeArrayBuffer(workbook, { format: 'custom-json' });
   * ```
   */
  registerWriteFormat(format: WriteFormatType): Promise<void>;

  // unregisterHandler?
}

/**
 * Options for filtering and searching format types.
 *
 * @remarks
 * All options are combined using **AND logic**. A format must match all specified criteria to be included.
 *
 * ## Search vs Filters
 *
 * ### `search` - Case-insensitive partial match (OR across fields)
 * Searches across multiple fields (key, extensions, MIME type, tags, description) and includes
 * formats where **ANY** field contains the search term.
 *
 * ### Other options - Exact filters (AND across options)
 * All other options are exact filters that must match precisely. A format must satisfy
 * **ALL** specified filters to be included.
 *
 * @example
 * ```typescript
 * // Search: Find formats containing "excel" anywhere
 * getFormats({ search: 'excel' }); // Matches xlsx (in description), xml (in tags), etc.
 *
 * // Filter: Get only xlsx format
 * getFormats({ ext: '.xlsx' }); // Exact match on extension
 *
 * // Combined: Search for "excel" AND only default formats
 * getFormats({ search: 'excel', isDefault: true });
 *
 * // Multiple filters: xlsx extension AND spreadsheet tag
 * getFormats({ ext: '.xlsx', tags: 'spreadsheet' });
 * ```
 */
export interface GetFormatsOptions {
  /**
   * Case-insensitive partial search across multiple fields.
   *
   * @remarks
   * Searches in: key, file extensions, MIME type, tags, and description.
   * Returns formats where **ANY** field contains the search term (OR logic).
   *
   * Use this for user-facing search boxes or fuzzy matching.
   *
   * @example
   * ```typescript
   * // Find all Excel-related formats
   * getFormats({ search: 'excel' });
   *
   * // Find formats with "xml" anywhere
   * getFormats({ search: 'xml' });
   * ```
   */
  search?: string;

  /**
   * Filter by exact file extension (e.g., `'.xlsx'`, `'.csv'`).
   *
   * @remarks
   * - Include the dot prefix
   * - Case-insensitive exact match
   * - Use this when you know the exact extension you want
   *
   * @example
   * ```typescript
   * // Get only XLSX formats
   * getFormats({ ext: '.xlsx' });
   * ```
   */
  ext?: string;

  /**
   * Filter by exact MIME type (e.g., `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`).
   *
   * @remarks
   * - Case-sensitive exact match
   * - Useful for matching HTTP Content-Type headers
   *
   * @example
   * ```typescript
   * // Get format by MIME type
   * getFormats({ mimeType: 'text/csv' });
   * ```
   */
  mimeType?: string;

  /**
   * Filter by exact format key.
   *
   * @remarks
   * - Case-insensitive exact match
   * - The key is the unique identifier for each format (e.g., 'xlsx', 'csv', 'sxl')
   * - Use this when you need to find a specific format by its identifier
   *
   * @example
   * ```typescript
   * // Get the XLSX format
   * getFormats({ key: 'xlsx' });
   * ```
   */
  key?: string;

  /**
   * Filter to only default format types.
   *
   * @remarks
   * - Exact boolean match
   * - Default formats are the primary/recommended formats for each category
   * - Useful for building UI pickers that should only show primary formats
   *
   * @example
   * ```typescript
   * // Get only default formats
   * getFormats({ isDefault: true });
   * ```
   */
  isDefault?: boolean;

  /**
   * Filter by exact tags (e.g., `'spreadsheet'`, `'text'`).
   *
   * @remarks
   * - Exact string match (case-sensitive)
   * - If multiple tags are needed, pass an array
   * - Returns formats that have **ALL** specified tags (AND logic)
   *
   * @example
   * ```typescript
   * // Get formats tagged as 'spreadsheet'
   * getFormats({ tags: 'spreadsheet' });
   *
   * // Get formats with both 'spreadsheet' and 'binary' tags
   * getFormats({ tags: ['spreadsheet', 'binary'] });
   * ```
   */
  tags?: string | string[];
}
