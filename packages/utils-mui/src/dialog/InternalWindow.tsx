import type React from 'react';
import {
  useMemo, useState, useRef, useEffect, useLayoutEffect, useId, memo, forwardRef
} from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';

import { useMergeRefs } from 'react-merge-refs';
import { Unstable_TrapFocus as TrapFocus } from '@mui/material';

import { alpha } from '@mui/system';
import { useTheme, useThemeProps, type Theme } from '@mui/material';
import { type DialogSlots } from '@mui/material';
import { Box } from '@mui/material';
import { Fade } from '@mui/material';
// import { Collapse } from '@mui/material';
import { DialogTitle } from '@mui/material';
import { Backdrop } from '@mui/material';
import { IconButton } from '@mui/material'
import { type TouchRippleActions } from '@mui/material';

import { type ModalProps } from '@mui/material';
import { type DialogProps } from '@mui/material';
import { type TransitionProps } from '@mui/material/transitions';

import { Paper, type PaperProps } from '@mui/material';

import Draggable, {
  type DraggableEventHandler, type DraggableEvent, type DraggableData
} from 'react-draggable';

import { type Point, type Size, CommonUtils } from '@sheetxl/utils';

import {
  useMeasure,
  useCallbackRef, useImperativeElement, KeyCodes, useFullscreenPortal, DynamicIcon,
  useFloatSurface, floatThemeScopeProps, useTranslator, zIndexVar, scrollbarThemedClassName
} from '@sheetxl/utils-react';

import { ExhibitTooltip } from '../button';
import { registerUtilsMuiLocales } from '../locales';

// See OverflowPalette: module-init registration from a module that is actually retained.
registerUtilsMuiLocales();

export interface DraggablePaperProps extends PaperProps {
  onDragStop?: DraggableEventHandler;
  PaperComponent?: React.JSXElementConstructor<PaperProps>;
  titleSize?: Size;
  rootSize?: Size;
  handleSel?: string;
  rootSel?: string;
  defaultPosition?: Point;
}

const ZERO_POINT = { x: 0, y: 0 };
const DraggablePaperComponent: React.FC<DraggablePaperProps & { ref?: any }> = memo(
  forwardRef<any, DraggablePaperProps>((props: DraggablePaperProps, refForwarded) => {
  const {
    defaultPosition = ZERO_POINT,
    PaperComponent = Paper,
    onDragStop,
    rootSel: _rootSel=".MuiModal-root", // TODO - use this?
    handleSel=".draggable-title",
    titleSize,
    rootSize,
    ...rest
  } = props;
  const refLocal = useRef(null);

  const dragBounds = useMemo(() => {
    // `useMeasure` reports an all-zero rect (a truthy object) until its ref is attached, so a
    // plain null-check treats "not measured yet" as "bounds are 0x0" and the clamp below pins the window
    // to 0,0 for that first render. Unmeasured must mean *no* bounds.
    if (!titleSize?.width || !titleSize?.height || !rootSize?.width || !rootSize?.height) return null;
    return {
      left: 0,
      top: 0,
      right: rootSize.width - titleSize.width,
      bottom: rootSize.height - titleSize.height
    }
  }, [titleSize, rootSize]);

  /* Where the user has dragged the window to; null means "still at `defaultPosition`". */
  const [dragPosition, setDragPosition] = useState<Point | null>(null);

  /*
   * We have to track the relative position from the start
   */
  const [offset, setOffset] = useState<Point | null>(null);

  // Derived during render rather than in effects. InternalWindow reveals the window in a *layout* effect
  // as soon as it has a position, so anything that arrives in a passive effect (or via an extra state
  // hop) loses the race: react-draggable falls back to its own 0,0 default while `position` is undefined
  // and the window paints in the corner before jumping into place.
  const position = dragPosition ?? defaultPosition ?? null;
  const boundedPosition = useMemo(() => {
    if (!position || !dragBounds) return position;
    // reposition within bounds
    return {
      x: Math.max(0, Math.min(position.x, dragBounds.right)),
      y: Math.max(0, Math.min(position.y, dragBounds.bottom))
    };
  }, [position, dragBounds]);

  const refMerged = useMergeRefs([refLocal, refForwarded]);
  return (
    <Draggable
      nodeRef={refLocal}
      handle={handleSel}
      cancel={'[class*="MuiDialogContent-root"]'}
      position={boundedPosition ?? undefined}
      // position={position}
      bounds={dragBounds ?? '.MuiModal-root'}
      // react-draggable's user-select hack calls `getSelection().removeAllRanges()` on drag-end AND
      // on unmount — and Chrome COLLAPSES a focused INPUT's selection/caret when the document
      // selection is cleared. That silently nuked a dialog field's select-all/caret ~100ms after
      // open (the paper remounts while the window settles) and on every window drag. The hack only
      // exists to stop text selection mid-drag, which the paper's own `userSelect: 'none'` already
      // does — so turn it off.
      enableUserSelectHack={false}
      onStop={onDragStop}
      // onMouseDown={(e: MouseEvent) => {
      //   console.log('onMousedown', e);
      // }}
      onStart={(e: DraggableEvent, data: DraggableData) => {
        const event = e as any;
        setOffset({
          x: (event.clientX ?? event.touches?.[0]?.clientX) - data.x,
          y: (event.clientY ?? event.touches?.[0]?.clientY) - data.y
        })
        // console.log('onStart', {
        //   x: (event.clientX ?? event.touches?.[0]?.clientX) - data.x,
        //   y: (event.clientY ?? event.touches?.[0]?.clientY) - data.y
        // });
      }}
      onDrag={(e: DraggableEvent, _data: DraggableData): void | false => {
        const event = e as any;
        if (!offset) return;
        const x = event.clientX ?? event.touches?.[0]?.clientX;
        const y = event.clientY ?? event.touches?.[0]?.clientY;
        setDragPosition({ x: x - offset.x, y: y - offset.y });
        // console.log('onDrag', x, y, offset);
        //  setPosition({ x: data.x, y: data.y });
      }}
    >
      <PaperComponent
        ref={refMerged as React.RefObject<HTMLDivElement>}
        {...rest}
      />
    </Draggable>
  );
}));

// TODO - zIndex on click (to do this we need to add items to a shared intermediate that is not document.body)
// TODO - create portal takes a key to avoid classes
// TODO - allow popper - (with an attachedElement) dialogs are modal, poppers attach, portal movables
// TODO - add resizable handle
// TODO? - allow for container?: PortalProps['container']; // default to document.body (or a shared child for z-ordering)

/**
 * If the x or y is a string it is assumed to be a percentage of available space before.
 */
export interface RelativePoint {
  x?: number | string;
  y?: number | string;
}

export interface InternalWindowProps<T=any, R=any> extends Omit<DialogProps, 'open'> {
  // redefine open to be optional since showModal managed this.
  open?: ModalProps['open'];

  /**
   * The dialog title
   */
  title?: string;

  /**
   * Query selector for the element to focus on show.
   *
   * @remarks
   * It would be better to honor autoFocus attribute but React is 'hiding' it
   */
  // TODO - remove
  autoFocusSel?: string;


  // TODO - REMOVE
  // modal
  onCancel?: () => void;
  // TODO - REMOVE
  // modal
  onDone?: (results?: any) => void;

  onShow?: () => void;
  onShown?: (internalWindow: IInternalWindowElement) => void;
  onHide?: () => void;

  /**
   * If true show a backdrop.
   *
   * @remarks
   * Our movable menu achieves modality without a background by listens to global clicks (and focus)
   * @defaultValue false
   */
  isModal?: boolean;

  /**
   * Temporarily SUSPEND the modality of an `isModal` window: the backdrop is not rendered, so the
   * application behind stays clickable, while the window itself remains open, visible and draggable.
   * The focus trap is already soft (it only enforces while the window has focus), so focus may move
   * to the application and back freely.
   *
   * @remarks
   * The Excel "RefEdit" pattern: a dialog hosting a reference field flips this on while the field is
   * PICKING (reference point mode), so a grid/header click reaches the sheet instead of the backdrop
   * (which would otherwise swallow — and cancel on — the click), and off again when the pick ends.
   * @defaultValue false
   */
  suspendModal?: boolean;

  /**
   * Whether closing returns the keyboard to whatever held it when the window opened.
   *
   * @remarks
   * `false` leaves focus alone — for a window whose OUTCOME moves the keyboard itself (Insert
   * Function seeds `=NAME(` and puts the user in the cell's editor). The restore is a queued frame,
   * so it lands *after* the new owner has taken focus and quietly takes it away again.
   *
   * A **thunk** is read as the window exits, which is what a window whose answer depends on how it
   * was dismissed needs — cancel restores, an insert that starts an edit does not. A boolean would
   * have to be in state, and there is no guaranteed render between the option being taken and the
   * exit transition starting.
   * @defaultValue true
   */
  restoreFocus?: boolean | (() => boolean);

  /**
   * When true this window is kept mounted after it closes so it can be reused (re-shown by bumping
   * {@link InternalWindowProps.revealToken}) instead of destroyed and rebuilt. This both makes
   * re-open instant and preserves position + content state.
   *
   * @remarks
   * `mui-modal-provider@2.4.6` wires `TransitionProps.onExited -> destroy` whenever `destroyOnClose`
   * is false (its issue #78), so a keep-alive window would otherwise be destroyed on the exit
   * transition anyway. When this is set we skip forwarding `onExited` to that destroyer.
   * @defaultValue false
   */
  disableAutoDestroy?: boolean;

  /**
   * Monotonic token bumped by the host each time a keep-alive window should re-show. An effect
   * re-reveals the window whenever this changes. Prop-based (not imperative on the DOM element,
   * whose identity is fragile across re-renders/StrictMode) and survives `updateModal` (which only
   * strips `open`). Ignored on first mount.
   */
  revealToken?: number;

  /**
   * Mount hidden and suppress the initial auto-reveal (used for prewarming — mounting + positioning a
   * keep-alive window ahead of its first real open). The window stays hidden until {@link revealToken}
   * is bumped (or this flips false). Needed because `mui-modal-provider`'s SHOW force-sets `open:true`,
   * so `open` alone can't keep a prewarmed window hidden.
   * @defaultValue false
   */
  startHidden?: boolean;

  /**
   * A default position for the window. The default is center at %50, %50.
   */
  initialPosition?: RelativePoint;

  /**
   * The components used for each slot inside.
   * @default {}
   */
  slots?: DialogSlots & {
    transition?: React.ComponentType<TransitionProps>;
    paper?: React.ComponentType<PaperProps>;
  };

  /**
   * The extra props for the slot components.
   * You can override the existing props or add new ones.
   * @default {}
   */
  slotProps?: {
    backdrop?: React.ComponentProps<typeof Backdrop>;
    paper?: PaperProps;
    transition?: TransitionProps;
  };

  /**
   * @deprecated v9 removed `TransitionProps` from `DialogProps`. Retained here
   * only because `useModal` (mui-modal-provider) still injects it; it is mapped
   * onto `slotProps.transition` internally.
   */
  TransitionProps?: TransitionProps;
};

const DEFAULT_RIPPLE_DURATION = 180;
const DEFAULT_POSITION = { x: '50', y: '50' };

export interface InternalWindowAttributes {
  focus: (options?: FocusOptions) => void;
}

/**
 * Type returned via ref property
 */
export interface IInternalWindowElement extends InternalWindowAttributes, HTMLElement {};

export const InternalWindow = memo(
  forwardRef<IInternalWindowElement, InternalWindowProps>((props, refForwarded) => {

  const propsThemed = useThemeProps({ props, name: 'MuiDialog' });
  const theme = useTheme();
  const t = useTranslator();
  const defaultTransitionDuration = {
    enter: theme.transitions.duration.enteringScreen * 0.66,
    exit: theme.transitions.duration.leavingScreen * 0.66,
  };

  const {
    title='SheetXL',
    onCancel,
    onDone,
    onShow,
    onShown,
    onHide,
    onClose: propOnClose,
    open,
    autoFocusSel,
    children,
    transitionDuration = defaultTransitionDuration,
    TransitionProps: propsTransitionPropsDeprecated, // Needed because useModal sets deprecated TransitionProps
    slots = CommonUtils.EmptyArray,
    slotProps = CommonUtils.EmptyArray,
    sx: propSx,
    className: propClassName,
    onMouseDown: propOnMouseDown,
    initialPosition: propInitialPosition = DEFAULT_POSITION,
    isModal = false,
    suspendModal = false,
    restoreFocus = true,
    disableAutoDestroy = false,
    revealToken,
    startHidden = false,
    ...rest
  } = propsThemed;

  // Extract components from slots with fallbacks
  let TransitionComponent = slots.transition ?? Fade as React.ComponentType<any>;
  const BackdropComponent = slots.backdrop ?? Backdrop;
  const PaperComponent = slots.paper ?? Paper as React.ComponentType<any>;

  // Extract props from slotProps
  let propTransitionProps = slotProps.transition;
  if (propsTransitionPropsDeprecated) {
    propTransitionProps = {
      ...propsTransitionPropsDeprecated,
      ...propTransitionProps
    };
  }
  const propBackdropProps = slotProps.backdrop;
  const propPaperProps = slotProps.paper;

  const [initialPosition, setInitialPosition] = useState<Point | null>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(false);

  const refRipple = useRef<TouchRippleActions>(null);

  const [refRootMeasure, rootRect] = useMeasure<HTMLElement>();
  const refRoot = useRef<HTMLElement>(null);
  const refWindowLocal = useRef<HTMLDivElement>(null);
  const [refTitleMeasure, titleRect] = useMeasure<HTMLElement>();

  const refPaperComponent = useRef<any>(null);

  // Unique, stable per-instance key for the portal into the shared container. Was a hard-coded
  // 'draggable-window' read from the reserved `key` prop (which never arrives via props), so EVERY
  // window portaled with the same key. Harmless when only one dialog lived at a time (destroy-on-
  // close), but keep-alive windows now coexist and React would reconcile same-keyed portals into the
  // same container as one — cross-dialog bleed (e.g. opening one reveals another).
  const portalKey = useId();

  // Reveal synchronously (pre-paint) once positioned, so the fade is not deferred by an extra
  // async commit. useLayoutEffect keeps the false->true edge Fade needs while collapsing the gap.
  // Prewarmed (startHidden) windows skip this initial reveal — they mount + position hidden and are
  // shown later via revealToken (or when startHidden flips false on the first real open).
  // Applies `open` only when it changes: a keep-alive window hides itself locally while `open` stays
  // true, so re-running this effect (e.g. a Suspense boundary re-showing) must not reveal it again.
  const refAppliedOpen = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!initialPosition || startHidden) return;
    const next = !!open;
    if (refAppliedOpen.current === next) return;
    refAppliedOpen.current = next;
    setVisible(next);
  }, [open, initialPosition, startHidden]);

  const handleCancel = useCallbackRef(() => {
    onCancel?.();
    setVisible(false);
  }, [onCancel]);

  // Position synchronously off getBoundingClientRect rather than the async useMeasure/ResizeObserver
  // state. On a warm open the (stable-lazy) content is already sized on the first layout pass, so the
  // window is placed and revealed before the first paint instead of after a ResizeObserver round-trip.
  // No dep array: re-runs each commit until positioned, which also covers cold lazy content settling.
  useLayoutEffect(() => {
    if (initialPosition) return;
    const root = refRoot.current;
    const paper = refPaperComponent.current;
    if (!root || !paper) return;
    const rootBounds = root.getBoundingClientRect();
    const paperBounds = paper.getBoundingClientRect();
    if ((rootBounds.width === 0 && rootBounds.height === 0) ||
        (paperBounds.width === 0 && paperBounds.height === 0)) return;

    const remainingHeight = rootBounds.height - paperBounds.height;
    const remainingWidth = rootBounds.width - paperBounds.width;
    let x = remainingWidth * (50 / 100);
    let y = remainingHeight * (50 / 100);
    if (typeof propInitialPosition?.x === 'number') {
      x = propInitialPosition.x;
    } else if (typeof propInitialPosition?.x === 'string') {
      x = remainingWidth * (parseFloat(propInitialPosition.x) / 100);
    }
    if (typeof propInitialPosition?.y === 'number') {
      y = propInitialPosition.y;
    } else if (typeof propInitialPosition?.y === 'string') {
      y = remainingHeight * (parseFloat(propInitialPosition.y) / 100);
    }

    setInitialPosition({ x, y });
  });

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [lastFocus, setLastFocus] = useState<HTMLElement | null>(null);
  const [relatedFocus, setRelatedFocus] = useState<HTMLElement | null>(null);

  const autoFocus = useCallbackRef((options?: FocusOptions): boolean => {
    if (lastFocus) {
      lastFocus.focus(options);
      return true;
    }
    if (autoFocusSel) {
      const autoFocus = refWindowLocal.current?.querySelectorAll?.(autoFocusSel);
      if (autoFocus && autoFocus.length > 0) {
        (autoFocus[0] as any)?.focus?.(options);
        return true;
      }
    }
    refWindowLocal.current?.focus?.(options);
    return false;
  }, [lastFocus, autoFocusSel]);

  const refLocal = useImperativeElement<IInternalWindowElement, InternalWindowAttributes>(refForwarded, () => ({
    focus: (options?: FocusOptions) => {
      autoFocus(options);
    }
  }), []);

  // Re-show a kept-alive window when the host bumps revealToken. Prop + effect instead of an
  // imperative DOM-element method: the element ref identity is not stable across re-renders /
  // StrictMode, so a stored reveal() went stale. Skips the initial value (first show is handled by
  // the positioning/reveal effects); focus follows from the `active` effect below.
  const refRevealToken = useRef(revealToken);
  useEffect(() => {
    if (revealToken === refRevealToken.current) return;
    refRevealToken.current = revealToken;
    setVisible(true);
  }, [revealToken]);

  const transitionProps:TransitionProps = {
    ...propTransitionProps,
    onExited: (node: HTMLElement) => {
      onDone?.(null);
      // Keep-alive: do NOT forward to the provider's injected onExited, which destroys the modal
      // (mui-modal-provider#78). Skipping it leaves the instance mounted for reuse via reveal().
      if (disableAutoDestroy) return;
      propTransitionProps?.onExited?.(node);
    },
    onExit: (node: HTMLElement) => {
      const closureRelatedFocus = relatedFocus;
      // Asked NOW (not at the last render) — see `restoreFocus`: the outcome that closed the window
      // is what decides, and it was taken after that render.
      const doRestore = typeof restoreFocus === 'function' ? restoreFocus() : restoreFocus;
      if (closureRelatedFocus && doRestore !== false) {
        requestAnimationFrame(() => {
          if (refLocal.current?.contains(document.activeElement))
            closureRelatedFocus.focus();
        });
      }
      onHide?.();
      setActive(false);
      propTransitionProps?.onExit?.(node);
    },
    onEntered: (node: HTMLElement, isAppearing: boolean) => {
      onShow?.();
      propTransitionProps?.onEntered?.(node, isAppearing);
    },
    onEntering: (_node: HTMLElement, _isAppearing: boolean) => {
      setActive(true);
      onShown?.(refLocal.current);
    }
  }

  useEffect(() => {
    if (active)
      autoFocus();
  }, [active]);


  const refPaperMerged = useMergeRefs([refPaperComponent, refForwarded]);
  let elemWindow = (
    <TrapFocus
      open={active}
      disableAutoFocus           // was focusTrapOptions.initialFocus: false
      disableEnforceFocus={!hasFocus} // soft trap: only enforce while the window has focus (was pause/unpause)
      // The focus trap restores too, from the same element and in the same case — but it reads this
      // flag from the render it OPENED on (its effect deps are `[open]`, deliberately: "we don't
      // support changing that prop on an open FocusTrap"), so it cannot be asked a question at close
      // time. A window that wants the decision made THEN (`restoreFocus` as a thunk, or a flat
      // `false`) therefore takes the restore off the trap entirely and leaves it to `onExit`, which
      // is the path that can ask. The plain default keeps both.
      disableRestoreFocus={restoreFocus !== true}
    >
      <TransitionComponent
        // appear
        in={visible}
        timeout={transitionDuration}
        role="presentation"
        {...transitionProps}
      >
        <Box // window container
          className="MuiDialog-container"
          ref={refWindowLocal}
          tabIndex={0}
          sx={{
            outline: 'none',
            position: 'relative'
          }}
          onKeyDown={(e: React.KeyboardEvent<any>) => {
            if (e.which === KeyCodes.Escape) {
              handleCancel();
              refRipple.current?.start(e, {
                center: false
              })
              setTimeout(() => refRipple.current?.stop(e), DEFAULT_RIPPLE_DURATION);
            }
            // needed because dialogs are not using command keys
            e.stopPropagation();
            // e.preventDefault();
          }}
        >
          <DraggablePaperComponent
            ref={refPaperMerged as React.RefObject<HTMLDivElement>}
            className={clsx({
              'Mui-focusVisible': hasFocus,
            }, propClassName, 'draggable', scrollbarThemedClassName)}
            // @ts-ignore
            sx={{
              pointerEvents: 'auto',
              userSelect: 'none',
              // A dialog is a FLOATING container — same kind of chrome as a menu (it leaves the layout and
              // covers arbitrary content), so it takes the same two tokens rather than raw paper. Falls
              // back to the paper it has always used, so this is inert until a host states them.
              backgroundColor: 'var(--sxl-color-elevated, var(--sxl-color-base-100))',
              border: '1px solid var(--sxl-color-elevated-border, transparent)',
              "&:hover:not([disabled]):not(.Mui-focusVisible)": {
                outline: (theme: Theme) => `solid ${alpha(theme.palette.text?.primary, 0.2)} 1px`,
              },
              '&.Mui-focusVisible': {
                outline: (theme: Theme) => `solid ${alpha(theme.palette.text?.primary, 0.2)} 1px`,
                // outline: (theme: Theme) => `solid ${alpha(theme.palette.primary.main, 0.4)} 1px`,
              },
              position: 'absolute',
              maxWidth: '100%',
              // maxHeight: '100%',
              ...propSx
            }}
            defaultPosition={initialPosition}
            titleSize={titleRect}
            rootSize={rootRect}
            PaperComponent={PaperComponent}
            {...rest}
            {...propPaperProps}
          >
          {title ?
            <DialogTitle
              className={clsx({
                ['Mui-selected']: hasFocus
              }, 'draggable-title')}
              sx={{
                cursor: 'move',
                display: 'flex',
                color: (theme: Theme) => theme.palette.text.secondary,
                boxSizing: 'border-box',
                padding: '0 0', // measure is not honoring border-box directive so we moved the paddings to the children
                transitionProperty: 'opacity',
                transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest}ms`, // should also use leaving screen with a second class
                opacity: 0.7,
                '&.Mui-selected': {
                  opacity: 1,
                  transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest / 2}ms`, // should also use leaving screen with a second class
                },
                // An app-local wash, deliberately NOT a token read — same style choice the task-pane title
                // bar makes (a title bar reads a step above what it covers). Translucent, so it lifts
                // whatever surface the window floats over without a per-placement value.
                backgroundColor: (theme: Theme) => alpha(theme.palette.action.hover, 0.03),
              }}
              ref={refTitleMeasure}
            >
              <Box
                sx={{
                  display: 'flex',
                  flex: '1 1 10%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: (theme: Theme) => theme.spacing(0.25),
                  marginBottom: (theme: Theme) => theme.spacing(0.25),
                  marginLeft: (theme: Theme) => theme.spacing(1),
                  marginRight: (theme: Theme) => theme.spacing(1),
                }}
              >
                <Box
                  sx={{
                    flex: '1 1 100%',
                    paddingLeft: (theme: Theme) => theme.spacing(1),
                  }}
                >
                  {title}
                </Box>
                <ExhibitTooltip
                  label={t('window.close')}
                >
                  <IconButton
                    aria-label="close"
                    sx={{
                      color: (theme: Theme) => {
                        return ((theme.palette.text as any).icon ?? theme.palette.action.active);
                      }
                    }}
                    touchRippleRef={refRipple}
                    onPointerDown={(e) => {
                      refRipple.current?.start(e, {
                        center: false
                      });
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPointerUp={handleCancel}
                  >
                    <DynamicIcon iconKey='Close'/>
                  </IconButton>
                </ExhibitTooltip>
              </Box>
            </DialogTitle>
          : null }
            {children}
          </DraggablePaperComponent>
        </Box>
      </TransitionComponent>
    </TrapFocus>
  );

  let backdrop = null;
  if (isModal && !suspendModal) {
    backdrop = (
      <BackdropComponent
        // ref={refLocal}
        {...propBackdropProps}
        open={visible}
        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
          handleCancel();
          propBackdropProps?.onMouseDown?.(e);
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          propOnClose?.(e, 'backdropClick');
          // onBackdropClick?.(e);
          propBackdropProps?.onClick?.(e);
        }}
        sx={{
          pointerEvents: 'auto',
          ...propBackdropProps?.sx
        }}
      />
    )
  }

  const { getPortalContainer } = useFullscreenPortal();

  // Carry the theme across the portal boundary onto the modal wrapper, exactly like FloatPopper does for
  // popups (THEMING-DESIGN §7). The dialog portals to the same theme-free container (document.body), so the
  // origin instance's theme — its `@scope` class(es) + `data-sxl-theme-surface`/`-mode` — must ride on the
  // wrapper or the dialog resolves default (light `app`) tokens. `useModal` renders us inside the studio's
  // `ExhibitFloatProvider`, so `useFloatSurface()` resolves the same scope the floats use.
  const { className: themeClassName, attrs: themeAttrs } = floatThemeScopeProps(useFloatSurface()?.themeScope);
  const refRootMerged = useMergeRefs([refLocal, refRootMeasure, refRoot]);
  return (
    // </Popper>
    (createPortal(<Box
      className={clsx('MuiModal-root', themeClassName)}
      {...themeAttrs}
      sx={{
        position: 'fixed',
        zIndex: zIndexVar('popup'),
        right: '0',
        bottom: '0',
        top: '0',
        left: '0',
        outline: '0',
        display: 'block',
        pointerEvents: 'none'
      }}
      ref={refRootMerged as React.RefObject<HTMLDivElement>}
      // onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
      //   if ((hasFocus && (e.target === refWindowLocal.current || (e.target as any).tabIndex < 0) && refWindowLocal.current?.contains(document.activeElement))) {
      //     e.preventDefault();
      //   }
      // }}
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
        // This code is preventing dialogs from dragging. What was I trying to do?
        if ((hasFocus && (e.target === refWindowLocal.current || (e.target as any).tabIndex < 0) && refWindowLocal.current?.contains(document.activeElement))) {
          // console.log('e.preventDefault');
          // e.preventDefault();
        }
      }}
      onContextMenu={(e) => {
        if (e.isPropagationStopped())
          return;
        e.preventDefault();
      }}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        if (!hasFocus && (e.target === refWindowLocal.current || (e.target as any).tabIndex < 0)) {
          // wrapping in a timer is a hack to prevent collisions with the focus trap
          setTimeout(() => { autoFocus(); }, 100);
        }
        setHasFocus(true);
        if (refWindowLocal.current?.contains(e.target) && e.target !== refWindowLocal.current) {
          setLastFocus(e.target);
        }
        if (e.relatedTarget && !relatedFocus) {
          setRelatedFocus(e.relatedTarget as HTMLElement);
        }
      }}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (!((refLocal?.current?.contains(e.relatedTarget)))) {
          setRelatedFocus(null);
          setHasFocus(false);
        }
      }}
    >
      {backdrop}
      {elemWindow}
    </Box>, getPortalContainer(), portalKey))
  );
}));

export default InternalWindow;
