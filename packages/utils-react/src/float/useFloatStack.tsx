import type React from 'react';
import {
  useState, useEffect, useMemo, useCallback, useRef, useReducer
} from 'react';

import { RenderSlot, type RenderSlotFn } from '../components';
import { useCallbackRef } from '../hooks';
import { KeyCodes } from '../types';

import { FloatStackProvider, useFloat } from './FloatStackContext';
import { defaultRenderFloatPanel } from './FloatProvider';
import { defaultRenderFloatPopupPanel, type FloatPopupPanelProps } from './FloatPopup';
import { type FloatPanelProps } from './FloatPanel';
import { type FloatPopperProps } from './FloatPopper';

import { useFloatSurface } from './FloatUtils';
import {
  createFloatRoot, DEFAULT_OPEN_DELAY, DEFAULT_CLOSE_DELAY, DEFAULT_CLOSE_OTHER_DELAY,
  type FloatRoot
 } from './_FloatUtils';
/**
 * Renders the floating panel for an open float.
 */
export type RenderFloatPanel = RenderSlotFn<FloatPanelProps>;

export interface FloatStackOptions {
  /**
   * Whether the panel grabs focus when it opens. @defaultValue `true` (menus / dialogs / anything the
   * user tabs through). Pass `false` for a **passive** popup — a tooltip or function/argument hint that
   * must not steal focus from the field being typed in.
   */
  autoFocus?: boolean;

  /**
   * Suppress the light-dismiss (close on outside mousedown / touch / focus). @defaultValue `false`.
   * - `true` — never light-dismiss; the caller drives visibility entirely (via `open`/`close`).
   * - a **predicate** `(target) => boolean` — light-dismiss normally, EXCEPT when it returns `true` for the
   *   event target, which is then treated as "on the float" (no close). Use this to extend "not away" beyond
   *   the float + anchor — e.g. a caret-following formula hint keeps the click-away, but exempts clicks back
   *   into the editor it annotates (which the portaled float doesn't contain), so those don't close it.
   */
  disableClickAway?: boolean | ((target: EventTarget | null) => boolean);

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
   * The float's content. `null` shows no popup but keeps the float in the stack — for toolbars and other
   * always-visible components that take part in the movable stacking.
   */
  renderPopupPanel?: RenderSlotFn<FloatPopupPanelProps> | null;

  /**
   * Passed to the underlying popup panel. `children` is excluded — content comes
   * from `renderPopupPanel`, and this keeps the option compatible with richer
   * surface popper types (e.g. MUI's render-prop `children`).
   */
  propsPopper?: Partial<Omit<FloatPopperProps, 'children' | 'ref'>>;

  /**
   * Render the floating panel surface. Defaults to {@link FloatPanel}.
   * Provide this to inject a custom surface (e.g. a themed card).
   */
  renderFloatPanel?: RenderFloatPanel;
}

// Stable reference key
export interface FloatReferenceKey {
  label: string | null;
}

// This is for tracking the rendered instance
export interface FloatReference {
  key: FloatReferenceKey;
  isRoot: boolean;

  parent: FloatReference | null;
  open(delay?: number): void;
  close: (delay?: number) => Promise<void> | null;
  closeChild: (delay?: number) => Promise<void> | null;

  onChildVisible: () => void;
  onChildHidden: () => void;

  closeAll: () => Promise<void> | null;

  /** The root of this float's tree. */
  getRoot: () => FloatReference;

  floatElement: () => HTMLElement | null,
  anchorElement: () => HTMLElement | any/*VirtualElement*/;
}

export interface FloatStack {
  /**
   * Float component to be injected
   */
  component: React.ReactNode;

  reference: FloatReference;

  /**
   * Whether the float is currently open (reactive — re-renders the caller as it flips). Lets a caller that
   * drives the float imperatively reconcile against its actual state — e.g. re-`open()` on a click only when
   * it isn't already open, after a light-dismiss (click-away / Esc) closed it.
   */
  isOpen: boolean;
}

/**
 * useFloatStack
 *
 * Keeps a list of stacked movable components. This acts like within but outside of the containment
 * hierarchy.
 *
 * TODO - abstract out clickAway perhaps with a useFloatStack context
 * TODO - abstract out FloatPanel factory into the same provider
 *
 */
export const useFloatStack = (props?: FloatStackOptions): FloatStack => {
  const {
    anchor,
    autoFocus = true,
    disableClickAway = false,
    label: propLabel = null,
    parentFloat: propParentFloat = null,
    onOpen: propOnOpen,
    onClose: propOnClose,
    propsPopper,
    renderPopupPanel : propRenderPopupPanel,
    renderFloatPanel : propRenderFloatPanel
  } = props ?? {};

  const onOpen = useCallbackRef(propOnOpen ?? (() => {}), [propOnOpen]);
  const onClose = useCallbackRef(propOnClose ?? (() => {}), [propOnClose]);

  // The floating surface: an explicit per-call option wins, then the ambient
  // surface from context (FloatProvider), then the neutral floor. `null` for
  // renderPopupPanel is meaningful (no popup, e.g. toolbars), so only an
  // *undefined* option falls through to the surface/default.
  const surface = useFloatSurface();
  const renderFloatPanel = propRenderFloatPanel ?? surface?.renderFloatPanel ?? defaultRenderFloatPanel;
  const resolvedRenderPopupPanel = propRenderPopupPanel === undefined
    ? (surface?.renderPopupPanel ?? defaultRenderFloatPopupPanel)
    : propRenderPopupPanel;

  // The enclosing float from context (the logical parent when no explicit prop).
  const ambientFloat = useFloat();

  // if true then open or opening (based on animation); false then closed or closing
  const [isOpen, setOpen] = useState<boolean | null>(null);
  // used for mounting unmounting
  const [isFloatVisible, setFloatVisible] = useState<boolean>(false);
  const [isChildVisible, setChildVisible] = useState<boolean>(false);

  // The logical parent float. An explicit prop wins (escape hatch for
  // programmatic/movable anchors), then the enclosing float from context. With
  // neither, fall back to a fresh per-instance root — NOT a shared global one —
  // so a provider-less top-level float still works without unrelated floats
  // cross-coordinating. Descendants inherit via context (an open float provides
  // itself), so only a truly provider-less top-level float ever creates one.
  const parentFloat:FloatReference = useMemo(() => {
    return propParentFloat ?? ambientFloat ?? createFloatRoot();
  }, []);

  // The shared state holder for this tree (open-tree, registry, debounce).
  // getRoot() is typed as the public FloatReference; the concrete root carries
  // the internal state.
  const root = useMemo(() => parentFloat.getRoot() as FloatRoot, []);

  const floatReferenceKey:FloatReferenceKey = useMemo(() => {
    return {
      label: propLabel
    };
  }, []);

  const refFloatElement = useRef<HTMLElement>(null);
  const refAnchorElement = useRef<any>(anchor);
  useEffect(() => {
    refAnchorElement.current = anchor;
  }, [anchor]);

  const _closeChild = (floatParentKey: FloatReferenceKey): Promise<void> | null => {
    const child = root.floatByParents.get(floatParentKey);
    let retValue: Promise<void> | null = null;
    if (child) {
      const childState = root.statesByMovables.get(child);
      retValue = childState?.close(0) ?? null;
    }
    return retValue
  }

  const closeMyChild = (): Promise<void> | null => {
    return _closeChild(floatReference.key);
  }

  // Every close in flight, not just the last one. A second close arriving before the first has
  // committed (two dispatches racing — a burst of clicks) used to REPLACE the pending entry, so the
  // first promise never settled and whoever awaited it (`execute`, which awaits `beforeExecute`)
  // stalled forever with its callback unrun.
  const [onClosePromises, setOnClosePromises] = useState<{ resolve: () => void }[] | null>(null);
  const closeFloat = (): Promise<void> | null => {
    if (!isOpen) {
      forceRender(); // We don't update on anchor or createPopup (perhaps we should)
      return null;
    }

    const promiseResolve = new Promise<void>((resolve: any) => {
      setOnClosePromises((prev) => [...(prev ?? []), { resolve }]);
    });
    // close my children if any
    closeMyChild();
    root.floatByParents.delete(parentFloat.key);
    setOpen(false);
    return promiseResolve;
  }

  useEffect(() => {
    if (onClosePromises) {
      for (const pending of onClosePromises) pending.resolve();
      setOnClosePromises(null);
    }
  }, [isFloatVisible, isChildVisible, onClosePromises]);

  const closeAllFloat = useCallback((): Promise<void> | null => {
    let floatRoot = parentFloat;
    while (floatRoot.parent) {
      floatRoot = floatRoot.parent;
    };

    return _closeChild(floatRoot.key);
  }, []);

  /**
   * Where focus was before this float opened, restored on close (see `handleClosing`).
   *
   * Captured at OPEN time rather than from the float receiving focus, because `onMount` — and so the
   * listener in `handleMount` — does not fire until the float has positioned, which is AFTER the
   * panel's own mount effects. A panel that focuses its own content (a menu taking the arrow keys)
   * would otherwise never be recorded, and focus would simply be dropped on close.
   */
  const refOriginalFocusedElement = useRef<HTMLElement>(null);

  // TODO - if open is called but there is a non opened parent we should ignore or force the parent to also open.
  const openFloat = () => {
    if (isOpen) {
      forceRender(); // We don't update on anchor or createPopup (perhaps we should)
      return;
    }

    if (parentFloat) {
      // ensure our parent is open
      const parentState = root.statesByMovables.get(parentFloat.key);
      parentState?.open(0);
    }

    const current = root.floatByParents.get(parentFloat.key);
    // If another sibling child float is opened with my parent close them unless we are on the root.
    if (current && current !== floatReferenceKey) {
      const sibling = root.statesByMovables.get(current);
      sibling?.close(0);
    }

    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && typeof active.focus === 'function') {
      refOriginalFocusedElement.current = active;
    }

    requestAnimationFrame(() => {
      root.floatByParents.set(parentFloat.key, floatReference.key);
      setOpen(true);
    });
  };

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  const renderPopupPanel = useCallback((props: FloatPopupPanelProps): React.ReactNode => {
    if (resolvedRenderPopupPanel === null) return null;
    return resolvedRenderPopupPanel({
      closeFloat: stableClose,
      closeFloatAll: stableCloseAll,
      ...props
    });
  }, [resolvedRenderPopupPanel]);
  const disablePopup = resolvedRenderPopupPanel === null;

  const stableOpen = useCallbackRef((delay: number = DEFAULT_OPEN_DELAY) => {
    return root.debounce(delay, openFloat, new Set([floatReference]), false)();
  }, [openFloat]);
  const stableClose = useCallbackRef((delay: number = DEFAULT_CLOSE_DELAY) => {
    return root.debounce(delay, closeFloat, root.descendants(floatReference), true)();
  }, [closeFloat]);
  const stableCloseMyChild = useCallbackRef((delay: number = DEFAULT_CLOSE_OTHER_DELAY) => {
    return root.debounce(delay, closeMyChild, root.descendants(root.getChildRef(floatReference)), true)();
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
      getRoot: () => root,
      floatElement: () => refFloatElement.current,
      anchorElement: () => refAnchorElement.current
    } as FloatReference;
  }, []);

  useEffect(() => {
    root.statesByMovables.set(floatReferenceKey, floatReference);
  }, [floatReference]);

  useEffect(() => {
    return () => {
      root.statesByMovables.delete(floatReferenceKey);
      stableClose(0); // close on destroy
    }
  }, []);

  useEffect(() => {
    if (isOpen && !disablePopup) {
      setFloatVisible(true);
      parentFloat.onChildVisible();
    }
  }, [isOpen, disablePopup])

  useEffect(() => {
    if (!isOpen || disablePopup) return;
    return root.addOpenPopup(floatReference);
  }, [isOpen, disablePopup]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.which !== KeyCodes.Escape)
      return;
    event.preventDefault();
    event.stopPropagation();
    stableClose(0);
  }, []);

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
      // Fallback only — `openFloat` already captured the outgoing focus, and it saw a truer value than
      // `relatedTarget` can here (by now the panel may have focused its own content). Fills the gap
      // when nothing was focused at open time.
      if (refOriginalFocusedElement.current) return;
      refOriginalFocusedElement.current = event.relatedTarget as any;
    };
    // `focusin`, not `focus`: `focus` does not bubble, so a panel focusing a DESCENDANT (a menu list)
    // never reached a listener on the wrapper.
    element.addEventListener("focusin", handler, {
      once: true,
      passive: true
    });
    // A passive popup (autoFocus === false) must not grab focus — it would steal the caret from the
    // field being typed in (e.g. a function/argument hint over the formula editor).
    if (!autoFocus) return;
    const closureActiveElement = document.activeElement;
    requestAnimationFrame(() => {
      // Content that focused itself as it mounted (a checklist's search field, which forwards the
      // arrows and Space to its list) already has the focus by the time this effect runs, so the
      // snapshot above is that field and the test below would take the focus from it.
      if (element.contains(document.activeElement)) return;
      if (closureActiveElement === document.activeElement) {
        element.focus();
      }
   });
  }, [autoFocus]);

  const [movablePopup, setMovablePopup] = useState<React.ReactElement | null>();
  useEffect(() => {
    // if we pass a null renderPopupPanel we skip creating the movable panel but still want to 'mimic the events'.
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
    // Provide our own reference to everything rendered inside the popup (even
    // through the portal) so nested floats discover us as their parent without
    // prop drilling.
    setMovablePopup(
      <FloatStackProvider value={floatReference}>
      <RenderSlot render={renderFloatPanel} props={{
        // ambient surface props first so functional wiring below always wins
        ...surface?.propsFloatPanel,
        floatReference,
        open: isOpen === true,
        label: propLabel as string,
        anchorEl: anchor,
        onOpening: () => { onOpen?.(); parentFloat.onChildVisible(); },
        onClosing: handleClosing,
        onClose: () => { setFloatVisible(false); parentFloat.onChildHidden();},
        onMount: handleMount,
        propsPopper: {
          onKeyDown: handleKeyDown,
          onMouseEnter: (_e) => {
            // If we were scheduled to close and we have moved the mouse back over then don't cancel
            if (isOpen && root.lastDebounced?.isClose && root.lastDebounced.setReferences.has(floatReference)) {
              root.lastDebounced.fn.clear();
              root.lastDebounced = null;
              floatReference.closeChild(); // We reschedule our children to close however
            }
          },
          ...propsPopper
        },
        renderPopupPanel
      }} />
      </FloatStackProvider>);
  }, [isFloatVisible, isOpen, propLabel, disablePopup, propsPopper, renderPopupPanel, renderFloatPanel, surface?.propsFloatPanel, _]); // , anchor

  const closeListener = useCallbackRef((event: globalThis.MouseEvent | globalThis.KeyboardEvent) => {
    // Do nothing if clicking ref's element or descendent elements
    if (root.floatByParents.size === 0)
      return;

    let clickOnFloat = false;

    // Ask the event where it was dispatched, not the live tree. `composedPath()` is captured when the
    // event is dispatched, so it still names the float even if React replaces the clicked node midway
    // through this dispatch — which it does on a fast repeat click: the previous click's pending render
    // flushes when the next discrete event arrives, and `contains(event.target)` then tests a DETACHED
    // node and reports the click as "away", dismissing the popup the user is clicking IN.
    const path: EventTarget[] = event.composedPath?.() ?? [];
    const onElement = (element: HTMLElement | null | undefined): boolean => {
      if (!element) return false;
      return path.length > 0 ? path.includes(element) : !!element.contains?.(event.target as any);
    };

    root.floatByParents.forEach((value) => {
      const state = root.statesByMovables.get(value);
      if (clickOnFloat)
        return;
      if (!state) {
        return;
      }
      if (onElement(state.floatElement()))
        clickOnFloat = true;
      if (onElement(state.anchorElement()))
        clickOnFloat = true;
    });
    if (clickOnFloat)
      return;

    // A predicate `disableClickAway` extends "not away" beyond the float/anchor (e.g. clicks back into the
    // annotated editor) — treat a matched target as on-float and skip the close.
    if (typeof disableClickAway === 'function' && disableClickAway(event.target))
      return;

    closeAllFloat();
  }, [closeAllFloat, disableClickAway]);

  // click and focus away
  useEffect(() => {
    // only the open root listens; `disableClickAway === true` opts out entirely (caller-driven visibility).
    // A predicate still needs the listener (it decides per-event), so only the boolean-true form skips it.
    if (!isOpen || !parentFloat.isRoot || disableClickAway === true) {
      return;
    }
      const closeHandler = (event: globalThis.MouseEvent | globalThis.KeyboardEvent) => {
        closeListener(event);
      };
      document.addEventListener("mousedown", closeHandler);
      document.addEventListener("touchstart", closeHandler as EventListener);
      document.addEventListener("focus", closeHandler as EventListener);
    return () => {
      document.removeEventListener("mousedown", closeHandler);
      document.removeEventListener("touchstart", closeHandler as EventListener);
      document.removeEventListener("focus", closeHandler as EventListener);
    };
  }, [isOpen, parentFloat, disableClickAway]);

  return {
    component: movablePopup,
    reference: floatReference,
    isOpen: isOpen === true
  };
}