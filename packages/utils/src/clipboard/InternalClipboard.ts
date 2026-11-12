import { MimeType } from '../types';
import { CommonUtils, BufferUtils, ImageUtils } from '../utils';

import { type ReferenceableClipboard } from './ReferenceableClipboard';

const ERROR_INFO_SAFARI: InternalClipboard.ClipboardErrorInfo = {
  code: 'safari',
  message: `The Safari browser does not support advanced copy and paste.\nCopy and paste will be limited to within the browser tab.\n\nPlease use Chrome or Edge if external copy and paste is required.`
};
const ERROR_INFO_PERMS: InternalClipboard.ClipboardErrorInfo = {
  code: 'perms',
  message: `You do not have permissions to access the clipboard.\nAll copy and paste operations will be limited to the browser tab.`
};
// Safari can't do advanced clipboard at all, so its permission failures read as the Safari notice.
const ERROR_INFO_CLIPBOARD_PERMS: InternalClipboard.ClipboardErrorInfo =
  CommonUtils.getPlatform() === CommonUtils.OSType.Safari ? ERROR_INFO_SAFARI : ERROR_INFO_PERMS;

const ERROR_MESSAGES = {
  Safari: ERROR_INFO_SAFARI,
  Perms: ERROR_INFO_PERMS,
  PermsWrite: ERROR_INFO_CLIPBOARD_PERMS,
  PermsRead: ERROR_INFO_CLIPBOARD_PERMS
}


const whenDocumentFocus = async (): Promise<void> => {
  return new Promise<void>((resolve: () => void) => {
    if (document.hasFocus()) {
      resolve();
    } else {
      globalThis.addEventListener?.("focus", () => {
        resolve();
      }, { once: true});
    }
    (document.activeElement as HTMLElement).focus?.();
  });
}

const requestAction = async (permName: string, tryAction: () => boolean | Promise<boolean>, onFail: (error: any)=> void | Promise<void>) => {
  if (CommonUtils.getPlatform() === CommonUtils.OSType.Safari) {
    return await onFail(new Error(ERROR_INFO_SAFARI.message));
  };
  try {
    const tryActionIgnoreFocus = async (action: () => boolean | Promise<boolean>): Promise<boolean> => {
      try {
        return await action();
      } catch (error: any) {
        if (error.message?.includes(`Document is not focused`)) {
          return false;
        }
        throw error;
      }
    }
    const result = await globalThis?.navigator?.permissions?.query({
      // @ts-ignore
      name: permName,
      allowWithoutGesture: true,
      allowWithoutSanitization: true
    });
    let success = false;
    /* we could end up trying twice. This is ok as the first clipboard read during a prompt usually fails */
    if (result.state === 'prompt') {
      success = await tryActionIgnoreFocus(tryAction);
    }
    if (!success && result.state === 'granted') {
      success = await tryAction();
    }
    if (!success) {
      return await onFail(new Error(result.state));
    }
  } catch (error: any) {
    if (error.message === "No valid data on clipboard" || error.name === "DataError") return; // don't warn for invalid data.
    return await onFail(error);
  }
}

const readClipboardUnsanitized = async (clipboard: Clipboard | null): Promise<ClipboardItems | null> => {
  if (!clipboard) return null;
  try {
    // @ts-ignore
    return await clipboard.read({
      unsanitized: [MimeType.Html],
    })
  } catch (error: any) {
  }

  // try {
    return await clipboard.read();
  // } catch (error: any) {
    // if (!error.message?.includes(`Document is not focused`)) {
      // TODO - dispatch read error if not focus warning
      // throw error;
    // }
  // }
}

const readBlobFromClipboard = async (clipboard: Clipboard | null, mimeType: string): Promise<Blob | null> => {
  if (!clipboard) {
    return null;
  }
  const data = await readClipboardUnsanitized(clipboard);
  let foundType = false;
  for (let i=0; !foundType && data && i<data.length; i++) {
    foundType = data[i].types.includes(mimeType);
    if (foundType) {
      const blob = await data[i].getType(mimeType);
      return blob;
    }
  }
  return null;
}

/* Firefox doesn't support ClipboardItem and Chrome makes ClipboardItem unavailable if not secure so we polly. */
if (!globalThis.ClipboardItem) {
  const stringToBlob = (type: string, str: string): Blob => {
    return new Blob([str], {
      type,
    });
  }
  // We name this `_ClipboardItem` instead of `ClipboardItem` because we
  // implement our polyfill from the library as `ClipboardItem`.
  interface _ClipboardItem {
    // Safari 13.1 implements `presentationStyle`:
    // https://webkit.org/blog/10855/async-clipboard-api/
    readonly presentationStyle?: PresentationStyle; // [optional here, non-optional in spec]
    readonly lastModified?: number; // [optional here, non-optional in spec]
    readonly delayed?: boolean; // [optional here, non-optional in spec]
    readonly types: ReadonlyArray<string>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ClipboardItem/getType) */
    getType(type: string): Promise<Blob>;
    supports(type: string): boolean;
  }
  class ClipboardItemPolyfillImpl implements _ClipboardItem {
    protected _items: { [type: string]: Blob } = {};
    protected _types: ReadonlyArray<string>;
    protected _presentationStyle: PresentationStyle;
    constructor(
      items: Record<string, string | Blob | PromiseLike<string | Blob>>,
      options?: ClipboardItemOptions
    ) {
      this._types = Object.keys(items);
      const _items: { [type: string]: Blob } = {};
      // biome-ignore lint/suspicious/noRedeclare: This is a false positive from Biome. https://github.com/biomejs/biome/issues/175
      const itemKeys = Object.keys(items);
      for (let i=0; i<itemKeys.length; i++) {
        const key = itemKeys[i];
        let item = items[key];
        if (typeof item === "string") {
          _items[key] = stringToBlob(key, item);
        } else {
          _items[key] = item as any;
        }
      }
      this._items = _items;
      this._presentationStyle = options?.presentationStyle ?? "unspecified";
    }

    get types(): ReadonlyArray<string> {
      return this._types;
    }

    getType(type: string): Promise<Blob> {
      return Promise.resolve(this._items[type]);
    }
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ClipboardItem/supports_static) */
    supports(_type: string): boolean {
      return true;
    }
  }

  globalThis.ClipboardItem = ClipboardItemPolyfillImpl as any;
}
const readStringFromClipboard = async (clipboard: Clipboard | null, mimeType: string=MimeType.Html): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const blob = await readBlobFromClipboard(clipboard, mimeType);
      if (blob) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        }
        reader.onerror = () => {
          resolve('');
        }
        reader.readAsText(blob);
      } else {
        resolve('')
      }
    } catch (error: any) {
      reject(error)
    }
  });
}

const readHTMLFromClipboard = async (clipboard: Clipboard | null, mimeType: string=MimeType.Html): Promise<Document | null> => {
  const asString = await readStringFromClipboard(clipboard, mimeType);
  if (!asString) return null;
  let asHtmlDoc: Document | null = null;
  try {
    const domParser = new DOMParser();
    asHtmlDoc = domParser.parseFromString(asString, MimeType.Html);
  } catch (error: any) {
    console.warn(`Can't parse html from clipboard.`);
  }
  return asHtmlDoc;
}

const clearClipboard = async(clipboard: Clipboard | null): Promise<void> => {
  if (!clipboard)
    return;
  /* write with empty doesn't clear so we mimic with a writeText */
  await clipboard.writeText('');
}

const _ClipboardUtils = {
  readBlobFromClipboard,
  readStringFromClipboard,
  readHTMLFromClipboard,
  clearClipboard
};
export const ClipboardUtils = _ClipboardUtils;

const CLIPBOARD_UUID_TOKEN = 'clipboard-uuid';
const CLIPBOARD_UUID_MIMETYPE = `web text/uuid`;
const CLIPBOARD_HTML_UUID = (uuid: string) => `<div style="display:none" ${CLIPBOARD_UUID_TOKEN}="${uuid}"/>`;

const _MimeTypePlain =  { type: MimeType.Plain };
const _MimeTypeHtml =  { type: MimeType.Html };
const _MimeTypeUUID = { type: CLIPBOARD_UUID_MIMETYPE };

/**
 * Due to a limitation in the clipboard we use html to embed a reference id that
 * we then correlate to the reference in memory.
 *
 * Note - The clipboard API is pretty lacking at the moment. There are 2 existing apis. 1 new API on the way
 * 1. DataTransfer - Only works from the keyboard. ()
 * 2. ASYNC Api - HTML data is 'sanitized' both on read and write for chrome (safari doc says that they don't sanitize but need to confirm).
 *
 * Another option that google docs uses is to create a simple chrome extension:
 * https://stackoverflow.com/questions/9658282/javascript-cut-copy-paste-to-clipboard-how-did-google-solve-it
 * https://zapier.com/blog/why-cant-you-copy-and-paste-in-google-docs/
 *
 * https://github.com/w3c/editing/blob/gh-pages/docs/clipboard-pickling/explainer.md
 * https://chromestatus.com/feature/5649558757441536
 * https://bugs.chromium.org/p/chromium/issues/detail?id=1268679&q=clipboard%20read%20html&can=2
 * https://chromium.googlesource.com/chromium/src/+/2266c115486be4dd767585a9ee5321edd1a83bc9
 *
 */
const embedUUIDInHtml = (uuid: string, htmlAsString: string): string | null => {
  // TODO - be smarter and use reg ex to match uuid pattern. This would allow us to replace existing clipboard-ids
  let asEmbeddedString: string | null = null;
  try {
    const domParser = new DOMParser();
    const htmlDoc:Document = domParser.parseFromString(htmlAsString, MimeType.Html);
    const elem:Element | null = htmlDoc.body.firstElementChild;
    elem?.setAttribute(CLIPBOARD_UUID_TOKEN, uuid);
    asEmbeddedString = htmlDoc.getElementsByTagName("body")[0].innerHTML;
  } catch (error: any) {
    console.warn(`Can't embed uuid.`, error);
  }


  if (!asEmbeddedString) {
    // TODO - try to just replace with a regEx
  }
  return asEmbeddedString;
}

/**
 * Uses the clipboard event for a html that contains the clipboard-uuid.
 * Ideally we would use a private web mimeType.
 *
 * @remarks
 * We pass in a uuid since it's possible there may be more than one element
 * with a clipboard-uuid. This can occur in nested situations.
 */
const parseForUUIDInHtml = (uuid: string | null | undefined, docHtml: Document | null): boolean => {
  if (!docHtml || !uuid) {
    return false;
  }

  try {
    // TODO - just look in root element instead of using querySelector
    const elementsClipboardId = docHtml.querySelectorAll(`[${CLIPBOARD_UUID_TOKEN}="${uuid}"]`);
    if (elementsClipboardId && elementsClipboardId.length === 1) {
      return true;
    }

    const errorNode = docHtml.querySelector('parsererror');
    if (errorNode) {
      throw new Error('We are unable to parse node');
    }
    return false;
  } catch (error: any) {
    return false;
  }
}

/** @internal */
interface State {
  uuid: string | null; // uuid for reconciliating our items to the native clipboard
  items: ClipboardItems | null;
  ref: ReferenceableClipboard.ReferenceItem | null;
}

/**
 * The Internal clipboard is a replacement for the native clipboard api.
 * This should be used for several reasons:
 * 1. Guarantees that the intra-application clipboard actions will work even if system clipboard is unavailable.
 *    * This can be because the browser doesn't support it (e.g. Firefox)
 *    * The user has restricted native clipboard access
 *
 * 2. Polyfill for onclipboardchange event.
 *
 * 3. Implements {@link ReferenceableClipboard}. These are items that add a paste callback to the clipboard to allow for items
 * to only be copied when the paste operation is performed.
 *
 * InternalClipboard will attempt to sync with the native clipboard unless sync is false.
 * * If a mimetype is text/html/image then value will be copied to the clipboard.
 *
 * @remarks
 * * **TODO** - If native copy/paste events are fired wrap them.
 * * **TODO** - Once private web mimeTypes are widely supported we can use them rather than embedding into html
 * * **TODO** - Allow for service worker to copy across tabs and sessions.
 */

export class InternalClipboard implements ReferenceableClipboard {

  private _state: State | null = null;

  private _nativeClipboard: Clipboard | null = null;
  private _disableCheckOnFocus: boolean;
  // assigned in _init (called from the constructor)
  private _listeners!: Map<string, Map<EventListenerOrEventListenerObject, AddEventListenerOptions>>;
  private _listenersCapture!: Map<string, Map<EventListenerOrEventListenerObject, AddEventListenerOptions>>;

  private _onFocus: (() => void) | null = null;
  private _onBlur: (() => void) | null = null;

  constructor(options?: InternalClipboard.ConstructorOptions) {
    if ((options?.nativeClipboard === undefined || options?.nativeClipboard === true)) {
      try {
        this._nativeClipboard = globalThis?.navigator.clipboard;
      } catch (error: any) {
        if (options?.nativeClipboard === true) {
          console.warn(`NativeClipboard option set to true but no native clipboard available.`)
        }
      }
    } else if (options?.nativeClipboard === false) {
      this._nativeClipboard = null;
    } else {
      this._nativeClipboard = options?.nativeClipboard ?? null;
    }
    this._disableCheckOnFocus = options?.disableCheckOnFocus ?? false;
    this._init();
  }

  protected async _checkForChanges(): Promise<void> {
    // if no local clipboard don't check as we are not syncing.
    if (!this._nativeClipboard || !this._state || this._disableCheckOnFocus) {
      return;
    }

    await requestAction('clipboard-read', async () => {
      await whenDocumentFocus();
      // try to read from the native clipboard
      const uuid = await readStringFromClipboard(this._nativeClipboard, CLIPBOARD_UUID_MIMETYPE);
      if (!this._state) return true;
      if (uuid && uuid === this._state.uuid) {
        return true;
      }

      const asHTML = await readHTMLFromClipboard(this._nativeClipboard, MimeType.Html);
      if (!this._state) return true;
      if (parseForUUIDInHtml(this._state.uuid, asHTML)) {
        return true;
      }

      this.clear();
      return true;
    }, async (error) => {
      if (error?.message !== 'denied' && !error.message?.includes(`Document is not focused`) && (CommonUtils.getPlatform() !== CommonUtils.OSType.Safari)) {
        console.warn(`Unable to detect clipboard changes: `, error);
        // this.dispatchEvent(new Event('clipboarderrorread'));
      }
    });
  }

  protected _init(): void {
    const _self = this;

    this._listeners = new Map();
    this._listenersCapture = new Map();
    this._state = null;

    if (!this._nativeClipboard) return;
    this._onFocus = () => {
      // Note - clipboard check is only allowed if focused so polling on visible doesn't work.
      _self._checkForChanges();
    }

    this._onBlur = () => {
      globalThis.addEventListener?.("focus", _self._onFocus!, { once: true});
    }
    globalThis.addEventListener?.("blur", this._onBlur);

    /*
     * Note -
     * Because clipboardchange listener is not implemented we implement a faux event by
     * listening for window focus.
     *
     * https://bugs.chromium.org/p/chromium/issues/detail?id=933608
     */
    this._nativeClipboard.addEventListener('clipboardchange', (_e) => {
      // console.log('native clipboardchange', e);
      _self._checkForChanges();
    });
  }

  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clipboard/read) */
  async read(): Promise<ClipboardItems> {
    if (!this._nativeClipboard) {
      // pre-strict behavior: resolves null (not []) when there is no state
      return (this._state?.items ?? null) as ClipboardItems;
    }

    const _self = this;
    await requestAction('clipboard-read', async () => {
      await whenDocumentFocus();
      // try to read from the native clipboard
      if (this._state?.uuid) {
        const uuid = await readStringFromClipboard(this._nativeClipboard, CLIPBOARD_UUID_MIMETYPE);
        if (uuid && uuid  === _self._state?.uuid) {
          return true;
        }

        const asHTML = await readHTMLFromClipboard(this._nativeClipboard, MimeType.Html);
        if (parseForUUIDInHtml(_self._state?.uuid, asHTML))
          return true;
      }
      // doesn't match
      _self._state = {
        items: await readClipboardUnsanitized(this._nativeClipboard),
        uuid: null,
        ref: null
      }
      this.dispatchEvent(new Event('clipboardread'));
      return true;
    }, async (_error) => {
      // console.warn("read: clipboard-permission not granted: " + error);
      this.dispatchEvent(new Event('clipboarderrorread'));
    });

    return this._state?.items ?? [];
  }

  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clipboard/write) */
  async write(data: ClipboardItems): Promise<void> {
    return this._write({
      uuid: CommonUtils.uuidV4(),
      items: data,
      ref: null
    });
  }

  /** @internal */
  protected async _write(state: State): Promise<void> {
    if (!this._nativeClipboard) {
      this._state = state;
      this.dispatchEvent(new Event('clipboardwrite'));
      this.dispatchEvent(new Event('clipboardchange'));
      return;
    }
    const _self = this;
    const nativeData: ClipboardItem[] = [];
    const uuid = state.uuid;
    let items = state.items ?? [];
    const writeInternal = () => {
      _self._state = {
        uuid,
        ref: state.ref,
        items: nativeData
      }
      _self.dispatchEvent(new Event('clipboardwrite'));
      _self.dispatchEvent(new Event('clipboardchange'));
    }
    await requestAction('clipboard-write', async () => {
      await whenDocumentFocus();
      if (uuid && items.length === 0) {
        /* we need at least 1 item to store uuids */
        items.push(
          new ClipboardItem({
            [CLIPBOARD_UUID_MIMETYPE] : new Blob([uuid], _MimeTypeUUID)
          })
        );
        items.push(
          new ClipboardItem({
            [MimeType.Html] : new Blob([CLIPBOARD_HTML_UUID(uuid)], _MimeTypeHtml)
          })
        );
      }
      for (let i=0; i<Math.min(1, items.length); i++) { // native clipboard only supports 1 item.
        const item:ClipboardItem = items[i];
        // f there is an image or text and not html we create an html version.
        // then we update html to include a uuid. (ensure it doesn't have one.)
        let indexHtml = item.types.indexOf(MimeType.Html);
        let htmlString: string | null = null;
        if (indexHtml !== -1) {
          const asHTMLBlob = await item.getType(MimeType.Html);
          htmlString = await BufferUtils.blobToString(asHTMLBlob);
          if (htmlString) {
            // uuid is only null from clear(), which never reaches here (no items to iterate)
            htmlString = embedUUIDInHtml(uuid!, htmlString);
          }
        }
        if (!htmlString && item.types.includes((MimeType.Plain))) {
          const asTextBlob = await item.getType(MimeType.Plain);
          if (asTextBlob) {
            let textString:string | null = null;
            if (typeof asTextBlob === 'string') {
              console.warn('text as string', asTextBlob); // TODO - Review. I don't think this is possible.
              textString = asTextBlob;
            } else {
              textString = await BufferUtils.blobToString(asTextBlob);
            }
            if (textString) {
              htmlString = `<div ${CLIPBOARD_UUID_TOKEN}="${uuid}">${textString}</div>`;
            }
          }
        }
        if (!htmlString && item.types.includes((MimeType.Png))) {
          const image:Blob = await item.getType(MimeType.Png);
          const asBase64 = BufferUtils.arrayBufferToBase64(await image.arrayBuffer());
          htmlString = `<div ${CLIPBOARD_UUID_TOKEN}="${uuid}"><img src="${ImageUtils.DATA_URL_PNG_PREFIX + asBase64}"/></div>`;
        }
        if (!htmlString && uuid) {
          htmlString = CLIPBOARD_HTML_UUID(uuid);
        }
        const htmlEmbed = new Blob([htmlString ?? ''], _MimeTypeHtml)
        const newClipboardTypes: Record<string, Blob | Promise<Blob>> = {};
        const types = item.types;
        const typesLength = types.length;
        for (let i=0; i<typesLength; i++) {
          const type = types[i];
          if (i === indexHtml) {
            newClipboardTypes[type] = htmlEmbed;
          } else {
            newClipboardTypes[type] = item.getType(type);
          }
        }
        if (htmlString && indexHtml === -1) {
          newClipboardTypes[MimeType.Html] = htmlEmbed;
        }
        if (uuid) {
          newClipboardTypes[CLIPBOARD_UUID_MIMETYPE] = new Blob([uuid], _MimeTypeUUID);
        }

        nativeData.push(new ClipboardItem(newClipboardTypes))
      }
      try {
        /* write with empty doesn't clear */
        if (!nativeData || nativeData.length === 0) {
          await clearClipboard(this._nativeClipboard);
        } else {
          await this._nativeClipboard!.write(nativeData);
        }
      } catch (error: any) {
        if (!error.message?.includes(`Document is not focused`)) {
          console.warn('Unable to write to native clipboard: ', error);
          // TODO - dispatch write error
        }
      }
      writeInternal();
      return true;
    }, async (_error) => {
      // console.warn(`write: clipboard-permission not granted: `, _error);
      this.dispatchEvent(new Event('clipboarderrorwrite'));
      writeInternal();
    });
  }

  async writeReference<T extends ReferenceableClipboard.ReferenceItem>(data: T): Promise<void> {
    if (!data) {
      this.clear();
      return;
    }

    let errorCaught: any = null;
    const mimeTypes: Record<string, Blob> = {};
    try {
      const plain = await data.toText?.() ?? null;
      if (plain)
        mimeTypes[MimeType.Plain] = new Blob([plain ?? ''], _MimeTypePlain);
    } catch (error: any) {
      errorCaught = error;
      // console.warn('export to plain', error);
    }
    try {
      const html = await data.toHtml?.() ?? null
      if (html)
        mimeTypes[MimeType.Html] = new Blob([html], { type: MimeType.Html });
    } catch (error: any) {
      errorCaught = error;
      console.warn('export to html', error);
    }
    try {
      const image = await data.toImage?.() ?? null;
      if (image)
      mimeTypes[MimeType.Png] = image;
    } catch (error: any) {
      errorCaught = error;
      console.warn('export to png', error);
    }

    const retValue = this._write({
      uuid: CommonUtils.uuidV4(),
      ref: data,
      items: Object.keys(mimeTypes).length > 0 ? [new ClipboardItem(mimeTypes)] : null
    });

    if (errorCaught)
      throw errorCaught;
    return retValue;
  }

  clear(native: boolean = false): void {
    if (!this._state) return;
    this._state = null;
    // doesn't clear native clipboard we could do this with a write of empty string.
    if (native) {
      this._write({
        uuid: null,
        ref: null,
        items: null
      });
    }
    this.dispatchEvent(new Event('clipboardwrite'));
    this.dispatchEvent(new Event('clipboardchange'));
  }

  async readReference<T extends ReferenceableClipboard.ReferenceItem>(): Promise<T> {
    await this.read();
    return this._state?.ref as T ?? null;
  }

  /**
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clipboard/readText)
   */
  readText(): Promise<string> {
    return new Promise<string>(async (resolve: (result: string) => void, reject: any) => {
      const items = await this.read();
      let found: Blob | null = null;
      const itemsLength: number = items ? items.length : 0;
      for (let i=0; !found && i<itemsLength; i++) {
        const item = items[i];
        if (item.types.includes(MimeType.Plain)) {
          found = await item.getType(MimeType.Plain);
        }
      }
      if (!found) {
        resolve(''); // native read returns ''.
        return;
      }
      const reader = new FileReader();
      reader.onload = (): void => {
        resolve(reader.result as string);
      }
      reader.readAsText(found);
      reader.onerror = (error): void => {
        reject(error); // native read returns ''.
      }
    })
  }

  /**
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clipboard/writeText)
   */
  async writeText(data: string): Promise<void> {
    const writeData = [
      new ClipboardItem({
        [MimeType.Plain] : new Blob([data], _MimeTypePlain)
      })
    ];
    return this._write({
      uuid: CommonUtils.uuidV4(),
      items: writeData,
      ref: null
    });
  }

  /**
   * Events types supported: copy, cut, paste, nativeSyncWarning, and (clipboardchange as a polyfill)
   * @param type A known string type.
   * @param callback A Callback.
   * @param options Listener options.
   * @remarks
   * AddEventListenerOptions.signal is not supported.
   * useCapture is not supported.

   * @see
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener}
   */
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options: AddEventListenerOptions | boolean = {}): void {
    const listenersByType = ((options as AddEventListenerOptions)?.capture ? this._listenersCapture : this._listeners);
    let listeners = listenersByType.get(type);
    if (!listeners) {
      listeners = new Map();
      listenersByType.set(type, listeners);
    }
    if (!callback) return;
    listeners.set(callback, typeof options === 'boolean' ? {} : options);
  }

  /**
   * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
   */
  dispatchEvent(event: Event): boolean {
    if (!event) return false;
    const dispatchType = (listenersByType: Map<string, Map<EventListenerOrEventListenerObject, AddEventListenerOptions>>) => {
      const listeners = listenersByType.get(event.type);
      if (!listeners) return;
      listeners.forEach((options: AddEventListenerOptions, callback: EventListenerOrEventListenerObject) => {
        try {
          if (typeof callback === 'function') {
            (callback as EventListener)(event);
          } else if ((callback as any).handleEvent) {
            (callback as EventListenerObject).handleEvent(event);
          }
          if (options.once) {
            listeners.delete(callback);
          }
        } catch (error: any) {
          console.warn(error);
        }
      });
    }

    dispatchType(this._listenersCapture);
    dispatchType(this._listeners);

    return true;
  }

  /**
   * Removes the event listener in target's event listener list with the same type, callback, and options.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)
   */
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
    const listenersByType = ((options as AddEventListenerOptions)?.capture ? this._listenersCapture : this._listeners);
    const listeners = listenersByType.get(type);
    if (!listeners || !callback) {
        return;
    }
    listeners.delete(callback);
    if (listeners.size === 0) {
      listenersByType.delete(type);
    }
  }

  close(): void {
    if (this._onFocus) globalThis.removeEventListener?.("focus", this._onFocus);
    if (this._onBlur) globalThis.removeEventListener?.("blur", this._onBlur);
  }
}

/**
 * {@inheritDoc InternalClipboard}
 * @see
 * ### **Interface**
 *
 * {@link InternalClipboard}
 */
export namespace InternalClipboard {
  /**
   * Options for creating a new InternalClipboard
   */
  export interface ConstructorOptions {
    /**
     * If provided the clipboard will sync with the native clipboard.
     * @remarks
     * Set to null or false to disable nativeClipboard.
     * @defaultValue globalThis.navigator.clipboard
     */
    nativeClipboard?: Clipboard | boolean;
    /**
     * Allow for disabling clipboard read on window focus. This is
     * a 'polyfill' for clipboard change events but has some performance impact.
     */
    disableCheckOnFocus?: boolean;
  }

  /**
   * A language-free reason a clipboard operation could not complete. `@sheetxl/utils` is treated as a
   * third-party library and owns NO i18n — a UI host localizes by switching on this code against its
   * own message catalog.
   */
  export type ClipboardErrorReason = 'safari' | 'perms';

  /** A clipboard failure: a language-free {@link ClipboardErrorReason} plus developer-facing English. */
  export interface ClipboardErrorInfo {
    /** The reason code a UI host switches on to localize. */
    code: ClipboardErrorReason;
    /** Developer-facing English (logs / non-localized hosts). A localizing host IGNORES this. */
    message: string;
  }

  /**
   * Common Error messages related to the internal clipboard, each a language-free
   * {@link ClipboardErrorInfo.code} plus developer-facing English a UI host localizes.
   */
  export const ErrorMessages = ERROR_MESSAGES;

  /**
   * A Global instance.
   */
  export const Global = new InternalClipboard();
}