
import React, {
  useState, useEffect, useMemo, useCallback
} from 'react';

import { CommonUtils } from '@sheetxl/utils';
import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

import { defaultCreatePopupPanel, ExhibitPopupPanelProps } from './ExhibitPopup';
import { ExhibitPopperProps } from './ExhibitPopper';

import { ExhibitFloatPanel } from './ExhibitFloatPanel';


// TODO - auto focus as an options.
export interface FloatStackOptions {
  // autofocus and others

  // How to do context menu? What about toolbar
  anchor? : React.ReactElement | any /*VirtualElement | (() => VirtualElement);*/

  // purely for debugging.
  label?: string;

  /**
   * If nesting float stacks are being used pass this from parent
   */
  parentFloat?: FloatReference;

  onOpen?: () => void;
  onClose?: () => void;

  /**
   * If this returns `null` then will create a registered movable stacking.
   * This is done for toolbars and other permanent visible components that are integrated into the movable stack.
   */
  createPopupPanel?: (props: ExhibitPopupPanelProps) => any;//ReactElement<any>;
  /**
   * Passed to the underlying popup panel
   */
  popperProps?: Partial<ExhibitPopperProps>;
}

// Stable reference key
export interface FloatReferenceKey {
  label: string;
}

// This is for tracking the rendered instance
export interface FloatReference {
  key: FloatReferenceKey;
  isRoot: boolean;

  parent: FloatReference;
  open(delay?: number): void;
  close: (delay?: number) => Promise<void>;
  closeChild: (delay?: number) => Promise<void>;

  onChildVisible: () => void;
  onChildHidden: () => void;

  closeAll: () => Promise<void>;

  floatElement: () => HTMLElement,
  anchorElement: () => HTMLElement | any/*VirtualElement*/;
}

export interface FloatStack {
  /**
   * Float component to be injected
   */
  component: React.ReactNode;

  reference: FloatReference;
}

const mapGlobalFloatByParents = new Map<FloatReferenceKey, FloatReferenceKey>();
// only contains 1 keys
let globalRoot:FloatReference = null;
/**
 * Only open elements are here
 */
const mapGlobalStatesByMovables = new Map<FloatReferenceKey, FloatReference>();

const DEFAULT_OPEN_DELAY = 120;
const DEFAULT_CLOSE_DELAY = 60; // DEFAULT_OPEN_DELAY / 2
const DEFAULT_CLOSE__OTHER_DELAY = 360; // DEFAULT_OPEN_DELAY * 3


/**
 * Intercept all preventDefault calls and log them.
 * Useful for debugging.
 * #FocusDebug #DebugFocus #MonkeyPatch
 */
// var oldEPD = Event.prototype.preventDefault;
// Event.prototype.preventDefault = function() {
//     // debugger;
//     // console.warn('preventDefault', this);
//     oldEPD.call(this);
// };
// var oldFocus = HTMLElement.prototype.focus;
// HTMLElement.prototype.focus = function() {
//     // debugger;
//   console.warn('focus', this, document.activeElement);
//   oldFocus.call(this);
// };

let debouncedLastFloat = null;
const debounceFloat = (delay: number = null, fn: () => any, setReferences: Set<FloatReference>, isClose: boolean): () => any => {
  if (debouncedLastFloat) {
    debouncedLastFloat.fn.clear();
    debouncedLastFloat = null;
  }

  if (delay === 0)
    return fn;
  if (delay === null)
    delay = DEFAULT_OPEN_DELAY;
  const debouncedFn = CommonUtils.debounce(() => {
    return fn();
  }, delay);

  debouncedLastFloat = {
    fn: debouncedFn,
    setReferences,
    isClose,
  }
  return debouncedLastFloat.fn;
}

const getChildRef = (reference: FloatReference) => {
  const child = mapGlobalFloatByParents.get(reference.key);
  if (!child)
    return null;
  const childState = mapGlobalStatesByMovables.get(child);
  return childState || null;
}

const collectDescendants = (setDescendants: Set<FloatReference>, reference: FloatReference) => {
  if (reference === null)
    return;
  setDescendants.add(reference);
  const child = mapGlobalFloatByParents.get(reference.key);
  if (!child)
    return;
  const childState = mapGlobalStatesByMovables.get(child);
  if (!childState)
    return;

  collectDescendants(setDescendants, childState);
}

const descendants = (reference: FloatReference): Set<FloatReference> => {
  const setRet = new Set<FloatReference>();
  collectDescendants(setRet, reference);
  return setRet;
}

/**
 * useFloatStack
 *
 * Keeps a list of stacked movable components. This acts like within but outside of the containment
 * hierarchy.
 *
 * TODO - abstract out clickAway perhaps with a useFloatStack context
 * TODO - abstract out ExhibitFloatPanel factory into the same provider
 *
 */

export const useFloatStack = (props?: FloatStackOptions): FloatStack => {
  const {
    anchor,
    label: propLabel = null,
    parentFloat: propParentFloat = null,
    onOpen: propOnOpen,
    onClose: propOnClose,
    popperProps,
    createPopupPanel : propCreatePopupPanel = defaultCreatePopupPanel
  } = props ?? {};

  const onOpen = useCallbackRef(propOnOpen, [propOnOpen]);
  const onClose = useCallbackRef(propOnClose, [propOnClose]);

  // if true then open or opening (based on animation); false then closed or closing
  const [isOpen, setOpen] = useState<boolean>(null);
  // used for mounting unmounting
  const [isFloatVisible, setFloatVisible] = useState<boolean>(false);
  const [isChildVisible, setChildVisible] = useState<boolean>(false);

  const parentFloat:FloatReference = useMemo(() => {
    if (propParentFloat === null) {
        if (globalRoot === null) {
          globalRoot = {
            key: {
              label: 'root'
            },
            isRoot: true,
            parent: null,
            open: (): Promise<void> => { return null},
            close: (_delay?: number): Promise<void> => { return null },
            closeChild: (_delay?: number): Promise<void> => { return null },
            onChildVisible: () => {},
            onChildHidden: () => {},
            closeAll: (): Promise<void> => { return stableClose(0) }, // close on destroy
            floatElement: () => null,
            anchorElement: () => null
          }
        }
        return globalRoot;
      }
      return propParentFloat;
  }, []);

  const floatReferenceKey:FloatReferenceKey = useMemo(() => {
    return {
      label: propLabel
    };
  }, []);

  const refFloatElement = React.useRef<HTMLElement>(null);
  const refAnchorElement = React.useRef<any>(anchor);
  useEffect(() => {
    refAnchorElement.current = anchor;
  }, [anchor]);

  const _closeChild = (floatParentKey: FloatReferenceKey): Promise<void> => {
    const child = mapGlobalFloatByParents.get(floatParentKey);
    let retValue = null;
    if (child) {
      const childState = mapGlobalStatesByMovables.get(child);
      retValue = childState?.close(0);
    }
    return retValue
  }

  const closeMyChild = (): Promise<void> => {
    return _closeChild(floatReference.key);
  }

  // useEffect(() => {
  //   if (!isOpen)
  //     mapGlobalFloatByParents.delete(parentFloat.key);
  // }, [isOpen]);

  const [onClosePromise, setOnClosePromise] = useState<any>();
  const closeFloat = (): Promise<void> => {
    if (!isOpen) {
      forceRender(); // We don't update on anchor or createPopup (perhaps we should)
      return;
    }

    const promiseResolve = new Promise<void>((resolve: any, reject: any) => {
      setOnClosePromise((prev: any) => {
        if (prev) {
          // prev.reject();
        }
        return {
          resolve,
          reject
        }
      })
    });
    // close my children if any
    closeMyChild();
    // console.log('schedule: mapGlobalFloatByParents.delete', propLabel, parentFloat.key, mapGlobalFloatByParents);
    // Why is this in a requestAnimationFrame?
    // requestAnimationFrame(() => {
      mapGlobalFloatByParents.delete(parentFloat.key);
      // console.log('mapGlobalFloatByParents.delete', propLabel, parentFloat.key, mapGlobalFloatByParents);
      setOpen(false);
    // });
    return promiseResolve;
  }

  useEffect(() => {
    // We only fire the promise if. our child is hidden AND we are hidden (or don't have a popup)
    // Hmm, we commented this out because sometimes the promise never resolved and left things. 'hanging'
    //if (!isChildVisible && (!isFloatVisible || disablePopup) &&  onClosePromise) {
    if (onClosePromise) {
      onClosePromise.resolve();
      setOnClosePromise(null);
    }
  }, [isFloatVisible, isChildVisible, onClosePromise]);

  const closeAllFloat = useCallback((): Promise<void> => {
    let floatRoot = parentFloat;
    while (floatRoot.parent) {
      floatRoot = floatRoot.parent;
    };

    return _closeChild(floatRoot.key);
  }, []);

  // TODO - if open is called but there is a non opened parent we should ignore or force the parent to also open.
  const openFloat = () => {
    if (isOpen) {
      forceRender(); // We don't update on anchor or createPopup (perhaps we should)
      return;
    }

    if (parentFloat) {
      // ensure our parent is open
      const parentState = mapGlobalStatesByMovables.get(parentFloat.key);
      parentState?.open(0);
    }

    const current = mapGlobalFloatByParents.get(parentFloat.key);
    // If another sibling child float is opened with my parent close them unless we are on the root.
    if (current && current !== floatReferenceKey) {
      const sibling = mapGlobalStatesByMovables.get(current);
      sibling?.close(0);
    }

    // flushSync
    // console.log('schedule: mapGlobalFloatByParents.set', parentFloat.key, mapGlobalFloatByParents);
    requestAnimationFrame(() => {
      mapGlobalFloatByParents.set(parentFloat.key, floatReference.key);
      // console.log('mapGlobalFloatByParents.set', parentFloat.key, mapGlobalFloatByParents);
      setOpen(true);
    });
  };

  const [_, forceRender] = React.useReducer((s: number) => s + 1, 0);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    if (propCreatePopupPanel === null) return null;
    return propCreatePopupPanel({
      closeFloat: stableClose,
      closeFloatAll: stableCloseAll,
      ...props
    });
  }, [propCreatePopupPanel]);
  const disablePopup = propCreatePopupPanel === null;

  const stableOpen = useCallbackRef((delay: number = DEFAULT_OPEN_DELAY) => {
    return debounceFloat(delay, openFloat, new Set([floatReference]), false)();
  }, [openFloat]);
  const stableClose = useCallbackRef((delay: number = DEFAULT_CLOSE_DELAY) => {
    return debounceFloat(delay, closeFloat, descendants(floatReference), true)();
  }, [closeFloat]);
  const stableCloseMyChild = useCallbackRef((delay: number = DEFAULT_CLOSE__OTHER_DELAY) => {
    return debounceFloat(delay, closeMyChild, descendants(getChildRef(floatReference)), true)();
  }, [closeMyChild]);
  const stableCloseAll = useCallbackRef(closeAllFloat, [closeAllFloat]);

  const floatReference:FloatReference = useMemo(() => {
    return {
      key: floatReferenceKey,
      isRoot: false,
      label: propLabel,
      parent: parentFloat,
      onChildVisible: () => { setChildVisible(true) },
      onChildHidden: () => { setChildVisible(false) },
      open: stableOpen,
      close: stableClose,
      closeChild: stableCloseMyChild,
      closeAll: stableCloseAll,
      floatElement: () => refFloatElement.current,
      anchorElement: () => refAnchorElement.current
    };
  }, []);

  useEffect(() => {
    mapGlobalStatesByMovables.set(floatReferenceKey, floatReference);
  }, [floatReference]);

  useEffect(() => {
    return () => {
      mapGlobalStatesByMovables.delete(floatReferenceKey);
      stableClose(0); // close on destroy
    }
  }, []);

  useEffect(() => {
    if (isOpen && !disablePopup) {
      setFloatVisible(true);
      parentFloat.onChildVisible();
    }
  }, [isOpen, disablePopup])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.which !== KeyCodes.Escape)
      return;
    event.preventDefault();
    event.stopPropagation();
    stableClose(0);
  }, []);

  const refOriginalFocusedElement = React.useRef<HTMLElement>(null);
  const handleClosing = useCallback(() => {
    const closureOriginalFocusElement = refOriginalFocusedElement.current;
    const closureFloatElement = refFloatElement.current;

    if (closureOriginalFocusElement && closureFloatElement) {
      requestAnimationFrame(() => {
        // Note - if activeElement is body we assume that the element was close with no restore focus
        if (closureFloatElement.contains(document.activeElement) || document.activeElement === document.body) {
          closureOriginalFocusElement.focus();
        }
      });
      refOriginalFocusedElement.current = null;
    }
    onClose?.();
  }, []);

  const handleMount = useCallback((element: HTMLDivElement) => {
    refFloatElement.current = element;
    const handler = (event: globalThis.FocusEvent) => {
      refOriginalFocusedElement.current = event.relatedTarget as any;
    };
    // add focus listener once
    element.addEventListener("focus", handler, {
      once: true,
      passive: true
    });
    const closureActiveElement = document.activeElement;
    requestAnimationFrame(() => {
      if (closureActiveElement === document.activeElement) {
        element.focus();
      }
   });
  }, []);

  const [movablePopup, setMovablePopup] = useState<React.ReactElement>();
  useEffect(() => {
    // if we pass a null createPopupPanel we skip creating the movable panel but still want to 'mimic the events'.
    if (disablePopup) {
      if (isOpen)
        onOpen?.();
      else if (isOpen === false) // only if an explicit close as we default to null
        onClose?.();
    }
    if (!isFloatVisible) {
      setMovablePopup(null);
      return;
    }
    setMovablePopup(
      <ExhibitFloatPanel
        floatReference={floatReference}
        open={isOpen}
        label={propLabel as string}
        anchorEl={anchor}
        // focusEl={anchorRef.current}
        onOpening={() => { onOpen?.(); parentFloat.onChildVisible(); }}
        onClosing={handleClosing}
        onClose={() => { setFloatVisible(false); parentFloat.onChildHidden();}} //  onClose?.() onOpen?
        onMount={handleMount}
        popperProps={{
          onKeyDown: handleKeyDown,
          onMouseEnter: (_e) => {
            // If we were scheduled to close and we have moved the mouse back over then don't cancel
            if (isOpen && debouncedLastFloat?.isClose && debouncedLastFloat.setReferences.has(floatReference)) {
              debouncedLastFloat.fn.clear();
              debouncedLastFloat = null;
              floatReference.closeChild(); // We reschedule our children to close however
            }
          },
          ...popperProps
        }}
        createPopupPanel={createPopupPanel}
      />);
  }, [isFloatVisible, isOpen, propLabel, disablePopup, popperProps, createPopupPanel, _]); // , anchor

  const closeListener = useCallbackRef((event: globalThis.MouseEvent | globalThis.KeyboardEvent) => {
    // Do nothing if clicking ref's element or descendent elements
    if (mapGlobalFloatByParents.size === 0)
      return;

    // our logic is to find any elements that we clicked on
    // and then close all children of it. or close all
    // const allOpen = [];
    let clickOnFloat = false;

    mapGlobalFloatByParents.forEach((value) => {
      const state = mapGlobalStatesByMovables.get(value);
      if (clickOnFloat)
        return;
      if (!state) {
        // console.warn('no state:', value);
        return;
      }
      const floatElement = state.floatElement();
      if (floatElement?.contains?.(event.target as any))
        clickOnFloat = true;
      const anchorElement = state.anchorElement();
      if ((anchorElement as any)?.contains?.(event.target as any))
        clickOnFloat = true;
      // We clicked on a float container but we may still have children open
      // This was causing problems on mobile
      // if (clickOnFloat) {
      //   state.closeChild(0);
      // }
    });
    if (clickOnFloat)
      return;

    closeAllFloat();
  }, [closeAllFloat]);

  // click and focus away
  useEffect(() => {
    // only the open root listens
    if (!isOpen || !parentFloat.isRoot) {
      return;
    }
      const closeHandler = (event: globalThis.MouseEvent | globalThis.KeyboardEvent) => {
        closeListener(event);
      };
    // if (!options || options.mouseEvents !== false) {
      document.addEventListener("mousedown", closeHandler);
      document.addEventListener("touchstart", closeHandler);
    // }
    // if (!options || options.focusEvents !== false) {
      // console.log('add listener focus');
      document.addEventListener("focus", closeHandler);
    // }
    return () => {
      document.removeEventListener("mousedown", closeHandler);
      document.removeEventListener("touchstart", closeHandler);

      document.removeEventListener("focus", closeHandler);
    };
  }, [isOpen, parentFloat]);

  return {
    component: movablePopup,
    reference: floatReference
  };
}
