import type React from 'react';
import { useState, useRef } from 'react';

import { InternalClipboard, type ReferenceableClipboard } from '@sheetxl/utils';

import { singletonHook } from '../singletonHook';

/**
 * The shared clipboard handle behind {@link useGlobalClipboard}. Holds the active
 * {@link ReferenceableClipboard} plus the native copy/keystroke refs used to correlate a DOM
 * clipboard event with the in-app copy that produced it.
 */
interface ClipboardHandler {
  setClipboard(clipboard: ReferenceableClipboard): void;
  getClipboard(): ReferenceableClipboard;

  /* native support*/
  refNativeCopy: React.Ref<{ sourceElement: Element, args: ReferenceableClipboard.CopyOptions}>;
  refNativeLastKey: React.Ref<KeyboardEvent>;
}

const _EmptyClipboardHandle = {
  setClipboard: (_clipboard: Clipboard) => {
    throw new Error('This is only available via the useClipboard.');
  },
  getClipboard: () => InternalClipboard.Global,
  refNativeCopy: { current: null },
  refNativeLastKey: { current: null }
}

/**
 * The app-wide clipboard singleton. Exposes the active {@link ReferenceableClipboard} (defaulting to
 * `InternalClipboard.Global`) and the native copy/keystroke refs. Consumed by the clipboard
 * contributor (copy writes references here; paste reads them) and the marching-ants view.
 */
export const useGlobalClipboard = singletonHook<ClipboardHandler>(_EmptyClipboardHandle, () => {
  const [_clipboard, _setClipboard] = useState<ReferenceableClipboard>(InternalClipboard.Global);

  /*
   * These global references are used to track native keystroke (for paste) and native execCommand (for copy)
   */
  const refNativeCopy = useRef<{ sourceElement: HTMLElement, args: ReferenceableClipboard.CopyOptions}>(null);
  const refNativeLastKey = useRef<KeyboardEvent>(null);

  const clipboardHandler:ClipboardHandler = {
    setClipboard: (clipboard: ReferenceableClipboard) => _setClipboard(clipboard),
    getClipboard: () => _clipboard,
    refNativeCopy,
    refNativeLastKey
  }

  return clipboardHandler;
});
