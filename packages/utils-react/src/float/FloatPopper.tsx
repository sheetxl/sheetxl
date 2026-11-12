import React, {
  useRef, useState, useImperativeHandle, useMemo, useEffect, useCallback,
  forwardRef, memo
} from 'react';

import { createPortal } from 'react-dom';

import clsx from 'clsx';

import {
  useFloating, autoUpdate, offset, flip, shift, size,
  type Placement, type Strategy
} from '@floating-ui/react-dom';

import { CommonUtils } from '@sheetxl/utils';

import { useCallbackRef } from '../hooks';
import { useFullscreenPortal } from '../utils';
import {
  THEME_MODE_ATTR, THEME_SURFACE_ATTR, type ThemeAttrs,
  zIndexVar, offsetZIndex
} from '../theme';

import { floatThemeScopeProps } from './FloatUtils';
import { useElementThemeAttrs, useFloatThemeScope } from './_FloatTheme';

import styles from './FloatPopper.module.css';

export interface FloatPopperPosition {
  top: number;
  left: number;
}

/**
 * Minimal imperative handle to the underlying Floating UI positioner.
 *
 * Historically this returned a popper.js `Instance`; nothing actually consumed
 * it, so it is reduced to the one operation that is meaningful — forcing a
 * reposition.
 */
export interface FloatPopperInstance {
  /** Force the floating element to recompute its position. */
  update: () => void;
}

export interface FloatPopperRef {
  instance: () => FloatPopperInstance | null;
  element: () => HTMLElement | null;
}

/**
 * A virtual anchor: anything with a live client rect. It may name the element it moves **with**
 * (`contextElement`) — a grid range anchor names its pane — which restores Floating UI's DOM-side
 * triggers (ancestor scroll, layout shift, resize) for an anchor that has no element of its own, and
 * is where the popper reads the anchor's theme from (see {@link FloatPopperProps.themeFrom}).
 */
export interface FloatPopperVirtualAnchor {
  getBoundingClientRect: () => DOMRect;
  readonly contextElement?: Element;
}

/**
 * Virtual or real element used to anchor the popper.
 */
export type FloatPopperAnchor =
  HTMLElement
  | FloatPopperVirtualAnchor
  | (() => HTMLElement)
  | (() => FloatPopperVirtualAnchor);

/** A client rect (what Floating UI collides against); a `DOMRect` is one. */
export interface FloatPopperRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Offsets by axis (Floating UI's `offset` options): `mainAxis` pushes away from the anchor edge,
 * `crossAxis` slides along it, `alignmentAxis` slides along it for an aligned (`-start` / `-end`)
 * placement only, measured inward from the corner — so it survives a flip to the opposite corner.
 */
export interface FloatPopperOffsets {
  mainAxis?: number;
  crossAxis?: number;
  alignmentAxis?: number;
}

export interface FloatPopperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Whether the popper should be shown (drives the enter/exit transition).
   */
  open: boolean;
  /**
   * The element (or virtual element) the popper is positioned against.
   */
  anchorEl?: FloatPopperAnchor;
  /**
   * Explicit position. Takes precedence over `anchorEl`.
   */
  anchorPosition?: FloatPopperPosition;
  /**
   * @defaultValue 'bottom-start'
   */
  placement?: Placement;
  /**
   * `[skidding, distance]` offset (popper.js convention, preserved for compatibility): `skidding`
   * shifts along the anchor edge, `distance` pushes away from it. Or the per-axis object form
   * ({@link FloatPopperOffsets}) when the alignment axis matters.
   * @defaultValue [0, 2]
   */
  offsets?: number[] | FloatPopperOffsets;
  /**
   * If the panel can resize on overflow. Otherwise it will try to fit.
   * @defaultValue true
   */
  resizeOnOverflow?: boolean;
  /**
   * Where the popper may **live**: a live client rect, read on every reposition, that `flip` (and
   * `size`, when it resizes) collide against instead of the document — so a popup can be held inside a
   * region (a grid's data area) rather than the page. Floating UI still intersects it with the browser
   * viewport, so the popper never leaves the screen either.
   * @defaultValue none — the document
   */
  boundary?: () => FloatPopperRect;
  /**
   * Slide the popper back inside the boundary along the alignment axis when it would overflow (Floating UI
   * `shift`), keeping `padding` px from the edge. Off by default: for a panel larger than the viewport it
   * clamps to the boundary origin instead of staying anchored (add a `limitShift` limiter before turning
   * it on for such panels).
   * @defaultValue false
   */
  shift?: boolean | { padding?: number };
  /**
   * The enter transition (the grow-in). `false` renders the content positioned on its first frame,
   * with no transition wrapper — for a label that must track a gesture, not open like a menu.
   * @defaultValue true
   */
  transition?: boolean;
  /**
   * The portal container.
   * @defaultValue the fullscreen-aware root ({@link useFullscreenPortal})
   */
  container?: Element;
  /**
   * The stacking band. A number, or a `z-index` expression from {@link zIndexVar}.
   * @defaultValue `zIndexVar('popup')`
   */
  zIndex?: number | string;
  /**
   * Floating UI positioning strategy. `'fixed'` positions in client space — for a virtual anchor that
   * reports client rects and must not be offset by a positioned ancestor of the container.
   * @defaultValue 'absolute'
   */
  strategy?: Strategy;
  /**
   * Whose theme the popper carries across the portal (THEMING-DESIGN §7):
   * - `'provider'` — the nearest {@link FloatProvider}'s theme scope: the app's surface and mode, so a
   *   menu opened from a light grid in a dark app opens dark, following the app. When no provider supplies
   *   a theme, the anchor's is copied instead.
   * - `'anchor'` — the anchor element's own `data-sxl-theme-*` (for a virtual anchor, its
   *   `contextElement`'s), kept live: a label that belongs to the grid themes with the grid, even where the
   *   grid's mode differs from the app's. The provider's scope classes still apply.
   * @defaultValue 'provider'
   */
  themeFrom?: 'provider' | 'anchor';
  /**
   * Poll the anchor's position every animation frame while open (Floating UI
   * `autoUpdate({ animationFrame: true })`). Needed when the anchor is a VIRTUAL element that MOVES with no
   * scroll/resize event to observe — e.g. a caret-following formula hint whose rect changes as the caret
   * moves by click or arrow. Off by default: the per-frame poll has a cost, so only anchors that track a
   * moving point should enable it (a normal element/point anchor repositions fine on scroll/resize alone).
   *
   * A virtual anchor that exposes its own `contextElement` (the element it moves WITH — a grid range
   * anchor names its pane) does not need this: that element's scroll / resize / layout-shift triggers
   * are observed normally.
   * @defaultValue false
   */
  followAnchor?: boolean;

  label?: string;

  children?: React.ReactNode;

  onMount?: (element: HTMLDivElement, instance: FloatPopperInstance) => void;
  onOpening?: () => void;
  onOpen?: () => void;
  onClosing?: () => void;
  onClose?: () => void;

  ref?: React.Ref<FloatPopperRef>;
}

const defaultOffsets = [0, 2];

/** The real element an anchor stands on: the element itself, or a virtual anchor's `contextElement`. */
const resolveAnchorElement = (anchorEl: FloatPopperAnchor | undefined): Element | null => {
  const resolved = typeof anchorEl === 'function' ? anchorEl() : anchorEl;
  if (!resolved) return null;
  if ((resolved as Node).nodeType === 1) return resolved as Element;
  const ctx = (resolved as FloatPopperVirtualAnchor).contextElement;
  return ctx && (ctx as Node).nodeType === 1 ? ctx : null;
};

/**
 * Popper built directly on [Floating UI](https://floating-ui.com)
 * (`@floating-ui/react-dom`).
 *
 * A popper has 3 lifecycle states: mounted, visible, open.
 */
const FloatPopper: React.FC<FloatPopperProps> = memo(forwardRef<FloatPopperRef, FloatPopperProps>(
    (props, refForwarded) => {
  const {
    open: propOpen,
    children,
    label,
    offsets = defaultOffsets,
    anchorEl,
    anchorPosition,
    placement = 'bottom-start',
    resizeOnOverflow = true,
    boundary,
    shift: propShift = false,
    transition = true,
    container,
    zIndex: propZIndex,
    strategy = 'absolute',
    themeFrom = 'provider',
    followAnchor = false,
    style: propStyle,
    className: propClassName,
    onMount: propOnMount,
    onOpening: propOnOpening,
    onOpen: propOnOpen,
    onClosing: propOnClosing,
    onClose: propOnClose,
    ...rest
  } = props;
  if (Array.isArray(children))
    throw new Error('children can not be an array');

  const handleMount = useCallbackRef(propOnMount ?? (() => {}), [propOnMount]);
  const handleOpening = useCallbackRef(propOnOpening ?? (() => {}), [propOnOpening]);
  const handleOpen = useCallbackRef(propOnOpen ?? (() => {}), [propOnOpen]);
  const handleClosing = useCallbackRef(propOnClosing ?? (() => {}), [propOnClosing]);
  const handleClose = useCallbackRef(propOnClose ?? (() => {}), [propOnClose]);

  // controls whether the floating element is mounted (Floating UI positioning alive)
  const [isVisible, setVisible] = useState<boolean>(false);
  // controls whether the popper has positioned at least once
  const [isMounted, setIsMounted] = useState<boolean>(false);
  // controls the enter transition class
  const [isEntered, setEntered] = useState<boolean>(false);
  // overflow-constrained max height from the `size` middleware (when enabled)
  const [maxHeight, setMaxHeight] = useState<number>();
  // overflow-constrained max width from the `size` middleware (when enabled)
  const [maxWidth, setMaxWidth] = useState<number>();

  const refFloatElement = useRef<HTMLDivElement>(null);
  // Last non-empty anchor rect, used to survive a transient anchor detach/remount.
  const refLastAnchorRect = useRef<DOMRect | null>(null);

  const { getPortalContainer } = useFullscreenPortal();

  // The theme this float opens with (THEMING-DESIGN §7): the nearest FloatProvider's theme scope. The app
  // sets it (scope class + surface + mode); the grid sets none, so a grid-originated float inherits the
  // app's. Applied to the portal wrapper below. When absent (no provider yet supplies one), fall back to
  // copying the anchor's mode/surface via `closest()` — the interim path retired once every instance's
  // FloatProvider carries a theme.
  const themeScope = useFloatThemeScope();
  // The anchor's own theme attrs, live — what `themeFrom: 'anchor'` carries, and the provider-less fallback.
  const anchorAttrs = useElementThemeAttrs(anchorPosition ? null : resolveAnchorElement(anchorEl));

  // The boundary is read through a ref inside the middleware closures: Floating UI compares middleware by
  // source text and keeps the earlier instance when equal, so a closure over the prop itself would go stale.
  const refBoundary = useRef(boundary);
  refBoundary.current = boundary;
  const hasBoundary = !!boundary;
  // `null` = no shift; else the padding kept from the boundary edge.
  const shiftPadding = propShift ? (typeof propShift === 'object' ? (propShift.padding ?? 0) : 0) : null;

  // popper.js offset is `[skidding, distance]`; Floating UI splits the same concept into `crossAxis`
  // (skidding, along the anchor edge) and `mainAxis` (distance, away from it).
  const { mainAxis, crossAxis, alignmentAxis } = Array.isArray(offsets)
    ? { mainAxis: offsets[1] ?? 0, crossAxis: offsets[0] ?? 0, alignmentAxis: undefined }
    : { mainAxis: offsets.mainAxis ?? 0, crossAxis: offsets.crossAxis ?? 0, alignmentAxis: offsets.alignmentAxis };

  const middleware = useMemo(() => {
    const boundaryOf = (): FloatPopperRect | undefined => refBoundary.current?.();
    // Matches the original popper.js modifier set (offset + flip + maxSize); `shift` only on request.
    //
    // With a `boundary`, `flip` / `shift` / `size` collide against that one rect, read at compute time (it
    // moves between renders), so what the caller reports as the boundary is exactly what the popper is held
    // inside. Floating UI takes a raw rect in CLIENT coordinates and still intersects it with the viewport
    // (its default root boundary), so the popper can never leave the screen either. Without one, the
    // document is the root, as it always was for app menus.
    const retValue: any[] = [
      offset({ mainAxis, crossAxis, alignmentAxis }),
      hasBoundary ? flip(() => ({ boundary: boundaryOf() })) : flip({ rootBoundary: 'document' })
    ];
    if (shiftPadding !== null) {
      retValue.push(shift(() => ({ boundary: boundaryOf(), padding: shiftPadding })));
    }
    if (resizeOnOverflow) {
      // Replaces the former inlined `maxSize` / `applyMaxSize` popper modifier.
      // We drive maxHeight/maxWidth through React state (not a direct style
      // mutation on the floating element) because `autoUpdate` observes that
      // element with a ResizeObserver — mutating it in `apply` creates a
      // resize→reposition→resize feedback loop ("ResizeObserver loop
      // completed…") that can drop position updates and leave the panel
      // stranded at 0,0. `availableHeight`/`availableWidth` depend on the
      // anchor/boundary (and placement), not the panel's own size, so they are
      // stable and the `prev === next` guard settles after one update.
      //
      // `availableWidth` is placement-aware: for a panel anchored near the
      // right edge (bottom-start that flipped, or bottom-end) it reports the
      // room from the boundary's left to the anchor's aligned edge. Capping
      // maxWidth to it keeps a wide, wrapping panel (e.g. the overflow palette)
      // from running off the left of the screen — the content wraps instead.
      const apply = ({ availableHeight, availableWidth }: { availableHeight: number; availableWidth: number }): void => {
        const nextHeight = Math.max(0, Math.round(availableHeight - 10));
        setMaxHeight((prev) => (prev === nextHeight ? prev : nextHeight));
        const nextWidth = Math.max(0, Math.round(availableWidth - 10));
        setMaxWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      };
      retValue.push(hasBoundary
        ? size(() => ({ boundary: boundaryOf(), apply }))
        : size({ rootBoundary: 'document', apply }));
    }
    return retValue;
  }, [resizeOnOverflow, mainAxis, crossAxis, alignmentAxis, hasBoundary, shiftPadding]);

  // Virtual reference element, resolved on each reposition. Covers both an
  // explicit point (`anchorPosition`) and a real/lazy element (`anchorEl`).
  //
  // `contextElement` is important: it lets Floating UI's `autoUpdate` observe
  // the real anchor element (its resize + scroll ancestors). Without it a popup
  // can stick at 0,0 when the first measurement happens before the anchor has
  // laid out (e.g. a heavier toolbar button), because nothing then triggers a
  // re-position. A virtual anchor may name one of its own (see the getter).
  const anchor = useMemo(() => {
    const resolve = (): FloatPopperVirtualAnchor | null => {
      const resolved = typeof anchorEl === 'function' ? anchorEl() : anchorEl;
      return (resolved as FloatPopperVirtualAnchor) ?? null;
    };
    return {
      getBoundingClientRect: (): DOMRect => {
        if (anchorPosition) {
          return new DOMRect(anchorPosition.left || 0, anchorPosition.top || 0, 0, 0);
        }
        const rect = resolve()?.getBoundingClientRect?.();
        // A detached/unmounted anchor reports an all-zero rect. Re-positioning to
        // it would slam the panel to 0,0 — which happens when a tooltip-wrapped
        // trigger briefly remounts as its popup opens (the float then holds the
        // old, removed element). Hold the last good rect instead of jumping.
        if (rect && (rect.width || rect.height || rect.x || rect.y)) {
          refLastAnchorRect.current = rect;
          return rect;
        }
        return refLastAnchorRect.current ?? new DOMRect(0, 0, 0, 0);
      },
      get contextElement(): Element | undefined {
        if (anchorPosition) return undefined;
        // Only ever expose a *real* DOM element. Floating UI's `autoUpdate` walks the context
        // element's overflow ancestors (via getComputedStyle), so a plain `getBoundingClientRect`
        // object — a context-menu point — must not be passed or it throws on a non-Element.
        // A virtual anchor MAY name the element it moves with (a grid range anchor names its pane).
        // Honoring it restores `autoUpdate`'s DOM-side triggers — ancestor scroll, layout shift,
        // resize — for an anchor that would otherwise have none, which is the difference between
        // tracking on real events and needing `followAnchor`'s per-frame poll.
        return resolveAnchorElement(anchorEl) ?? undefined;
      }
    };
  }, [anchorPosition, anchorEl]);

  // `followAnchor` polls the anchor rect every frame — for a virtual anchor that moves with no scroll/resize
  // to observe (a caret). Otherwise the default `autoUpdate` (scroll/resize/ResizeObserver) is enough.
  const whileElementsMounted = useMemo(
    () => (followAnchor
      ? (reference: any, floating: any, up: () => void) => autoUpdate(reference, floating, up, { animationFrame: true })
      : autoUpdate),
    [followAnchor]
  );

  const {
    refs, floatingStyles, isPositioned, placement: resolvedPlacement, update
  } = useFloating({
    placement,
    strategy,
    middleware,
    whileElementsMounted,
    elements: { reference: anchor }
  });

  // Merge our own ref (used for focus / transition / onMount) with Floating UI's.
  const setFloatingRef = useCallback((node: HTMLDivElement | null) => {
    refFloatElement.current = node;
    refs.setFloating(node);
  }, [refs]);

  useImperativeHandle(refForwarded, (): FloatPopperRef => {
    return {
      instance: () => (refFloatElement.current ? { update } : null),
      element: () => refFloatElement.current
    };
  }, [update]);

  // open -> ensure visible
  useEffect(() => {
    if (propOpen) {
      setVisible(true);
    }
  }, [propOpen]);

  // first successful positioning -> mounted (+ onMount)
  useEffect(() => {
    if (isVisible && isPositioned && !isMounted) {
      setIsMounted(true);
      handleMount?.(refFloatElement.current!, { update });
    }
  }, [isVisible, isPositioned, isMounted]);

  // fire opening / closing lifecycle
  useEffect(() => {
    if (propOpen && isMounted) {
      handleOpening?.();
    } else if (!propOpen && isVisible) {
      handleClosing?.();
    }
  }, [propOpen, isMounted]);

  // drive enter transition once positioned (or, with none, report open at once)
  useEffect(() => {
    if (isVisible && isMounted && propOpen) {
      if (!transition) {
        setEntered(true);
        handleOpen?.();
        return;
      }
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
  }, [isVisible, isMounted, propOpen, transition]);

  // exit is immediate (matches prior behavior where exit timeout was 0 to avoid flicker)
  useEffect(() => {
    if (!propOpen && isVisible) {
      setEntered(false);
      setVisible(false);
      setIsMounted(false);
      handleClose?.();
    }
  }, [propOpen, isVisible]);

  // enter completion
  const handleTransitionEnd = useCallbackRef((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (propOpen && isEntered) {
      handleOpen?.();
    }
  }, [propOpen, isEntered]);

  if (!isVisible) return null;

  const transformOrigin = (resolvedPlacement ?? placement).startsWith('bottom') ? 'left top' : 'center bottom';

  // Carry the theme across the portal boundary onto the float wrapper (THEMING-DESIGN §7). The portal mounts
  // at a theme-free container (document.body), so the origin instance's theme must ride on the wrapper.
  //   `'provider'`: the nearest FloatProvider's `themeScope` — its scope class(es) make the instance's
  //   `@scope (.<class>){…}` rules apply here, and its app-driven surface/mode select the cell. This is what
  //   makes a menu from a light grid in a dark app open dark (it follows the app, whose provider it inherits).
  //   Interim fallback (no provider theme yet): the anchor's nearest mode/surface, relying on the global
  //   stylesheet — retired once every instance's FloatProvider carries a theme.
  //   `'anchor'`: the anchor's own mode/surface win (a grid label themes with its grid); the scope classes
  //   still come from the provider, since without one the portaled element is outside every `@scope` root.
  const { className: themeClassName, attrs: providerAttrs } = floatThemeScopeProps(themeScope);
  let themeAttrs: ThemeAttrs;
  if (themeFrom === 'anchor') {
    themeAttrs = { ...providerAttrs, ...anchorAttrs };
  } else if (!themeClassName && !providerAttrs[THEME_MODE_ATTR] && !providerAttrs[THEME_SURFACE_ATTR]) {
    themeAttrs = anchorAttrs;
  } else {
    themeAttrs = providerAttrs;
  }

  // A closing popper drops one step below an opening sibling for the commit they overlap.
  const zIndex = propZIndex ?? zIndexVar('popup');
  const content = children || CommonUtils.EmptyArray;

  return createPortal(
    <div
      ref={setFloatingRef}
      className={clsx(styles['float-popper'], propClassName, themeClassName)}
      role={undefined}
      // The side Floating UI settled on (`flip` may have swapped the requested one), for content that
      // draws differently by side — a pointer, a shadow — without a render of its own.
      data-placement={resolvedPlacement ?? placement}
      {...themeAttrs}
      style={{
        ...floatingStyles,
        maxHeight: resizeOnOverflow ? maxHeight : undefined,
        maxWidth: resizeOnOverflow ? maxWidth : undefined,
        zIndex: propOpen ? zIndex : offsetZIndex(zIndex, -1),
        pointerEvents: (isVisible && propOpen) ? undefined : 'none',
        ...propStyle
      }}
      {...rest}
    >
      {transition ? (
        <div
          className={clsx(styles['float-popper-grow'], { [styles['entered']]: isEntered })}
          style={{ transformOrigin }}
          onTransitionEnd={handleTransitionEnd}
        >
          {content}
        </div>
      ) : content}
    </div>,
    container ?? getPortalContainer()
  );
}));

FloatPopper.displayName = 'FloatPopper';

export { FloatPopper };
