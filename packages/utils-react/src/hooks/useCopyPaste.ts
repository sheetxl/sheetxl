import React, {
  useEffect, useState, useRef, useMemo, useCallback
} from 'react';

import { singletonHook } from '../singletonHook';

import {
  CommonUtils, MimeType, ReferenceableClipboard, InternalClipboard, ClipboardUtils
} from '@sheetxl/utils';

import { ICommands, SimpleCommand } from '../command';
import { useCallbackRef } from '../hooks';
import { KeyModifiers } from '../types';
import { useNotifier, IReactNotifier } from './useNotifier';

export interface CopyPasteResults {
  copy: (args?: ReferenceableClipboard.CopyOptions) => void;

  paste: (args?: ReferenceableClipboard.PasteOptions) => void;
  /**
   * The clipboard used. Generally the `InternalClipboard.Global`.
   */
  clipboard: ReferenceableClipboard;
}

export interface CopyPasteProps {
  source: ReferenceableClipboard.Source;

  target?: ReferenceableClipboard.Target;

  commands?: ICommands.IGroup;

  /**
   * Called when the clipboard is updated.
   * @param reference If `null` then the clipboard was cleared.
   */
  onClipboardUpdate?: (reference: ReferenceableClipboard.ReferenceItem | null) => void;
  /**
   * Called after paste has been called.
   */
  onPaste?: (reference: ReferenceableClipboard.ReferenceItem, args: ReferenceableClipboard.PasteOptions) => void;
}

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

/**
 * Copy paste hook.
 */
export const useCopyPaste = (props: CopyPasteProps): CopyPasteResults => {
  const {
    source,
    target,
    onPaste: propOnPaste,
    onClipboardUpdate: propOnClipboardUpdate,
    commands,
    // onNativeCopy: propOnNativeCopy,
    // onNativePaste: propOnNativePaste,
  } = props;

  const notifier: IReactNotifier = useNotifier();
  const onClipboardUpdate = useCallbackRef(propOnClipboardUpdate, [propOnClipboardUpdate]);
  const onPaste = useCallbackRef(propOnPaste, [propOnPaste]);

  // const onNativeCopy = useCallbackRef(propOnNativeCopy, [propOnNativeCopy]);
  // const onNativePaste = useCallbackRef(propOnNativePaste, [propOnNativePaste]);

  const {
    getClipboard,
    refNativeCopy,
    // refNativeLastKey
  } = useGlobalClipboard();
  const clipboard = getClipboard();

  useMemo(() => {
    const refCommandSourceTarget = source?.element;
    const refCommandTargetTarget = target?.element ?? source?.element;

    if (!commands) return;
    const copyCommands = [
      new SimpleCommand('cut', refCommandSourceTarget, {
        label: 'Cut',
        description: 'Remove the selection and put it on the clipboard so you can paste it somewhere else.',
        icon: 'cut',
        shortcut: {
          key: 'X',
          modifiers: [KeyModifiers.Ctrl]
        }
      }),
      new SimpleCommand('copy', refCommandSourceTarget, {
        label: 'Copy',
        description: 'Put a copy of the selection on the clipboard so you can paste it somewhere else.',
        icon: 'copy',
        shortcut: {
          key: 'C',
          modifiers: [KeyModifiers.Ctrl]
        }
      }),
      new SimpleCommand('paste', refCommandTargetTarget, {
        label: 'Paste',
        description: 'Add content on the clipboard to your document.',
        icon: 'paste.yellow',
        shortcut: [
          {
            key: 'V',
            modifiers: [KeyModifiers.Ctrl]
          }, { // for testing
            key: 'F8',
            modifiers: [KeyModifiers.Ctrl]
          }
        ]
      })
    ];
    commands?.addCommands(copyCommands, true);
  }, [commands]);

  const handleCopy = useCallbackRef(async (args: ReferenceableClipboard.CopyOptions) => {
    if (!source?.element) return;
    let clipboardItem = null;

    // let caughtPartialError:PartialError = null;
    try {
      // We can't use legacy api in async process and and new api is not ready
      // const hideBusy = await notifier.showBusy?.("Copying...");
      clipboardItem = source.doCopy?.(args);

      if (typeof clipboardItem === "string") {
        await clipboard.writeText(clipboardItem as string);
      } else {
        await clipboard.writeReference(clipboardItem as any); // TODO - fix typing
      }

      // hideBusy?.();
    } catch (error: any) {
      throw error;
      // throw new Error(error.message, { cause: error });
      // notifier?.showError?.(error);
    }
  }, [source, notifier]);

  /**
   * User is trying to copy from outside the app
   */
   const handleCopyProgrammatic = useCallbackRef(async (args: ReferenceableClipboard.CopyOptions) => {
    const element = source?.element?.();
    if (!element) return;
    refNativeCopy.current = {
      sourceElement: element,
      args
    }

    try {
      await handleCopy(args);
    } catch (error: any) {
      notifier.showError?.(error);
    }
  }, [source?.element, notifier]);

  const handleCutProgrammatic = useCallback(() => {
    handleCopyProgrammatic({
      isCut: true
    });
  }, []);

  const handlePasteItem = useCallbackRef(async (target: ReferenceableClipboard.Target, item: ReferenceableClipboard.ReferenceItem, args: ReferenceableClipboard.PasteOptions): Promise<void> => {
    try {
      // Do paste against the target
      const pasteContinue = await target.doPaste(item, args);
      if (pasteContinue === false)
        return;
      // notify the hook item
      onPaste?.(item, args);
    } catch (error: any) {
      notifier.showError?.(error);
    }
  }, [onPaste]);

  const handlePaste = useCallbackRef(async (nativeItems: ReferenceableClipboard.NativeItems, item: ReferenceableClipboard.ReferenceItem, args: ReferenceableClipboard.PasteOptions) => {
    const element = target?.element?.();
    if (element) {
      await CommonUtils.whenFocus(element);
    }
    // if (!CommonUtils.hasFocus(element)) {
    //   return;
    // }
    if (!nativeItems && !item)
      return;

    // There is a slight delay with this; should we check amount of content before calling blocking?
    const hideBusy = await notifier.showBusy?.("Pasting...");

    if (item) {
      try {
        await handlePasteItem(target, item, args);
        hideBusy?.();
        return;
      } catch (error: any) {
        hideBusy?.();
        notifier.showError?.(error);
      }
    }

    let importFromExternal = target.importFromExternal;
    if (!importFromExternal) {
      importFromExternal = (_items?: ReferenceableClipboard.NativeItems, _options?: ReferenceableClipboard.CopyOptions): ReferenceableClipboard.ReferenceItem => {
        return {
          getItemType: (): string => {
            return "text";
          },
          toText: (): string => {
            return nativeItems.text;
          },
          isClipboardItem: true
        }
      }
    }

    let externalItem:ReferenceableClipboard.ReferenceItem | Promise<ReferenceableClipboard.ReferenceItem>;
    try {
      externalItem = await importFromExternal(nativeItems, {
        isCut: false,
      });
    } catch (error: any) {
      hideBusy?.();
      notifier.showError?.(error);
    }
    if (!externalItem) {
      hideBusy?.();
      return;
    }

    try {
      const resolvedExternalItem = await Promise.resolve(externalItem);
      await handlePasteItem(target, resolvedExternalItem, args);
      hideBusy?.();
    } catch (error: any) {
      hideBusy?.();
      notifier.showError?.(error);
    }
  }, [handlePasteItem, target, notifier]);

  /**
   * User is trying to paste from outside the app.
   */
  const handlePasteProgrammatic = useCallbackRef(async (args: ReferenceableClipboard.PasteOptions): Promise<void> => {
    if (!target?.element) return;

    try {
      const ref = await clipboard.readReference();
      if (ref) {
        await handlePaste(null, ref, args);
        return;
      }

      // const types = await Promise.all([
      /* we can add back promise all. We were testing copy paste on mac/safari. */
      const types = [];
      types[0] = await ClipboardUtils.readStringFromClipboard(clipboard, MimeType.plain);
      types[1] = await ClipboardUtils.readHTMLFromClipboard(clipboard, MimeType.html);
      types[2] = await ClipboardUtils.readBlobFromClipboard(clipboard, MimeType.png);
      // ])

      const nativeItems:ReferenceableClipboard.NativeItems = {
        text: types[0] ?? null,
        html: types[1] ?? null,
        image: types[2] ?? null
      }

      await handlePaste(nativeItems, null, args);
    } catch (error: any) {
      if (error?.message === 'Document is not focused.') return;
      notifier.showError?.(error);
    }
  }, [handlePaste, target?.element, notifier]);

  // TODO - Review and move to InternalClipboard or remove. For Reference
  const _handleCopyNative = useCallbackRef(async (_e: ClipboardEvent) => {
    /*
    // if (warnIfSafari()) return;
    if (!source?.element || !CommonUtils.hasFocus(source.element())) return;

    // TODO - only do this if it's is ctrl c or ctrl x.
    const key = e.type === 'copy' ? 'copy' : 'cut';
    const command = commands.getCommand(key);

    const handleProgrammatic = e.type === 'copy' ? handleCopyProgrammatic : handleCutProgrammatic;
    // We set execute to null and then call it to force hooks to be called (ripple and other notifications)
    command.updateCallback(() => {
      command.updateCallback(handleProgrammatic);
    }).execute();

    const defaultArgs = {
      isCut : e.type === 'cut',
      editMode: {
        key
      }
    };
    try {
      const args = onNativeCopy ? onNativeCopy(refNativeLastKey.current, refNativeCopy.current?.args ?? defaultArgs) : refNativeCopy.current?.args ?? defaultArgs;
      if (args !== null && handleCopy) {
        await handleCopy({
          ...defaultArgs,
          ...args
        });
        // e.preventDefault();
      }
    } catch (error: any) {
      // editModeHandler.setMode(null);
      notifier.showError?.(error);
    }
    */
  }, [source?.element]);

  // TODO - Review and move to InternalClipboard or remove. For Reference
  const _handlePasteNative = useCallbackRef(async (_e: ClipboardEvent) => {
    /*
    const targetElement = target?.element?.();

    if (!targetElement || !CommonUtils.hasFocus(targetElement) || e.defaultPrevented) return;
    if (refNativeLastKey.current && refNativeLastKey.current.ctrlKey && refNativeLastKey.current.key === 'v') {
      // const command = commands.getCommand('paste');
      // We set execute to null and then call it to force hooks to be called (ripple and other notifications)
      // await command.updateCallback(() => {}).execute();
      // handlePasteProgrammatic({});
      // command.updateCallback(handlePasteProgrammatic);

      // command.execute();
      // We set execute to null and then call it to force hooks to be called (ripple and other notifications)
      // command.updateCallback(() => {
      //   handlePasteProgrammatic();
      //   // command.updateCallback(handlePasteProgrammatic);
      // }).execute();
    }

    const args = onNativePaste ? onNativePaste(refNativeLastKey.current, undefined) : undefined;

    // const items = e?.clipboardData?.items;
    const asHTMLText = e?.clipboardData?.getData(MimeType.html);
    let html = null;
    if (asHTMLText) {
      try {
        const domParser = new DOMParser();
        html = domParser.parseFromString(asHTMLText, MimeType.html);
      } catch (error: any) {
      }
    }

    let image = null;
    // TODO - look for image as a file object
    const text = e?.clipboardData?.getData(MimeType.plain);
    const nativeItems:NativeClipboardItems = {
      text,
      html,
      image
    }

    // if (args !== null && handlePaste) {
    handlePaste(nativeItems, null, args);
    console.log('preventDefault')
    e.preventDefault();
    // }
    */
  }, [target?.element, handlePaste, notifier]);

  useEffect(() => {
    if (!clipboard) return;

    const onClipboardChange = async (_event: Event) => {
      const ref = await clipboard.readReference();
      onClipboardUpdate?.(ref);
    };
    const onClipboardErrorRead = (_event: Event) => {
      // console.log('read error', _event);
      notifier.showMessage?.(InternalClipboard.ErrorMessages.PermsRead, { onceKey: 'clipboard.features'});
    }
    const onClipboardErrorWrite = (_event: Event) => {
      // console.log('write error', _event);
      notifier.showMessage?.(InternalClipboard.ErrorMessages.PermsWrite, { onceKey: 'clipboard.features'});
    }

    clipboard.addEventListener('clipboardchange', onClipboardChange);
    clipboard.addEventListener('clipboarderrorread', onClipboardErrorRead);
    clipboard.addEventListener('clipboarderrorwrite', onClipboardErrorWrite);
    return () => {
      clipboard.removeEventListener('clipboardchange', onClipboardChange);
      clipboard.removeEventListener('clipboarderrorread', onClipboardErrorRead);
      clipboard.removeEventListener('clipboarderrorwrite', onClipboardErrorWrite);
    }
  }, [clipboard, notifier]);

  useEffect(() => {
    // TODO - all of this should be in InternalClipboard or removed. - here for reference.
    /*
    if (source && source.element && source.doCopy) {
      console.log('add copy / cut listener');
      document.addEventListener("cut", handleCopyNative);
      document.addEventListener("copy", handleCopyNative);
    }
    if (target && target.element && target.doPaste) {
      document.addEventListener("paste", handlePasteNative);
    }

    const handleKeyStroke = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // if use native copy/paste
      refNativeCopy.current = undefined;
      refNativeLastKey.current = e;
    }

    document.addEventListener("keydown", handleKeyStroke, { capture: true });

    return () => {
      document.removeEventListener("cut", handleCopyNative);
      document.removeEventListener("copy", handleCopyNative);
      document.removeEventListener("paste", handlePasteNative);


      document.removeEventListener("keydown", handleKeyStroke, { capture: true });
    };
    */
  }, [handleCopy, handlePaste, source, target]);

  useEffect(() => {
    commands?.getCommand('cut')?.updateCallback(handleCutProgrammatic).update({
      disabled: !source || !target
    });
    commands?.getCommand('copy')?.updateCallback(handleCopyProgrammatic).update({
      disabled: !source
    });
    commands?.getCommand('paste')?.updateCallback(handlePasteProgrammatic).update({
      disabled: !target
    });
  }, [source, target, commands]);


  return {
    paste: handlePasteProgrammatic,
    copy: handleCopyProgrammatic,
    clipboard
  };
};