import { EditMode } from '../mode';

/**
 * Extended clipboard that allows for writing non serializable objects
 * to the clipboard.
 */
export interface ReferenceableClipboard extends Clipboard {
  /**
   * Allows for an item to be added to the clipboard that is not a Blob.
   */
  readReference<T extends ReferenceableClipboard.ReferenceItem>(): Promise<T>;
  /**
   * Allows for an item to be added to the clipboard that is not a serializable blob.
   */
  writeReference<T extends ReferenceableClipboard.ReferenceItem>(data: T): Promise<void>;
  /**
   * Simple method for clearing the clipboard.
   * @param native By default this will only clear the reference. Set to `true` to clear the native clipboard items if available.
   */
  clear(native?: boolean): void;
}

/**
 * {@inheritDoc ReferenceableClipboard}
 * @see
 * ### **Interface**
 *
 * {@link ReferenceableClipboard}
 */
export namespace ReferenceableClipboard {

  /**
   * Interface that allows for references to be copied.
   */
  export interface ReferenceItem<T=any> {
    // mimetype
    // description
    // thumbnail

    /**
     * Indicates if the operation is a cut.
     * @defaultValue false
     */
    isCut?(): boolean;
    /**
     * Allow items to be copied as text.
     */
    toText?(): Promise<string> | string;
    /**
     * Allow items to be copied as html.
     */
    toHtml?(): Promise<string> | string;
    /**
     * Allow items to be copied as an image Blob.
     */
    toImage?(): Promise<Blob> | Blob;
    /**
     * A key that indicates the type of item returned from {@link getItem}.
     *
     * @remarks
     * This should be unique key for the application.
     */
    getItemType(): string;
    /**
     * Access to the underling reference.
     */
    getItem?(): T;
    /**
     * When adding an item to the clipboard an EditMode can be associated.
     */
    // TODO - I don't think this belongs here. see if we can move this concern into ISheet.
    editMode?(): EditMode;
    /**
     * For runtime introspection.
     */
    isClipboardItem: true;
  }

  /**
   * Represents the native data types that can be stored on the clipboard and accessed via the Clipboard API.
   */
  export interface NativeItems {
    /**
     * Plain text content from the clipboard.
     */
    text?: string;
    /**
     * HTML content from the clipboard, represented as a `Document` object.
     */
    html?: Document;
    /**
     * Image data from the clipboard, represented as a `Blob` object.
     */
    image?: Blob;
  }

   /**
   * A clipboard source is an interface will create a record to place on the clipboard.
   */
   export interface Source {
    /**
     * A method that allows or focus to be called. (and supports an addEventListener('focus'))
     */
    element: () => HTMLElement;
    /**
     * Create a ReferenceableClipboardItem to place on the clipboard.
     */
    doCopy?: (options: CopyOptions) => ReferenceableClipboard.ReferenceItem | string;
  }

  /**
   * A clipboard target is an interface will read items from the clipboard.
   */
  export interface Target<T=any, E extends HTMLElement=HTMLElement> {
    /**
     * A method that allows or focus to be called. (and supports an addEventListener('focus'))
     */
    element: () => E;
    /**
     * If this is not specified then native paste will still be attempted.
     */
    doPaste?: (item: ReferenceableClipboard.ReferenceItem<T>, options: PasteOptions) => boolean | Promise<boolean>;
    /**
     * Creates a `ReferenceableClipboardItem` from native clipboard items (text, html, or images). This is used to
     * import external clipboard data into an 'internal clipboard' representation.
     *
     * @param items Native clipboard items.
     * @param options Additional arguments for creating the `ReferenceableClipboardItem`.
     * @returns A `ReferenceableClipboardItem` (or a Promise resolving to one) if successful;
     *   `null` if the data cannot be converted or the operation should be aborted.
     *
     * @throws `Error` If an error occurs during the creation of the `ReferenceableClipboardItem`.
     *   The error will be caught and displayed to the user.
     */
    importFromExternal?: (items: ReferenceableClipboard.NativeItems, options?: CopyOptions) => ReferenceableClipboard.ReferenceItem<T> | Promise<ReferenceableClipboard.ReferenceItem<T>> | null;
  }

  /**
   * Copy options.
   */
  export interface CopyOptions {
    /**
     * Indicates if a cut is desired.
     * @defaultValue false
     */
    isCut?: boolean;
    /**
     * When performing a copy the editMode type to use.
     * @defaultValue 'copy'
     */
    // TODO  remove
    // TODO - replace with a callback
    // onCopy?: (item: ReferenceableClipboard.ReferenceItem) => void;
    editMode?: EditMode;
  }

  /**
   * Paste options.
   */
  export interface PasteOptions {
    /**
     * If true then formatting will be ignored.
     * @defaultValue false
     */
    contentsOnly?: boolean;
  }
}