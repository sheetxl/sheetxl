import React, {
  useMemo, useState, useRef, useEffect, useLayoutEffect, memo, forwardRef
} from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';

import { mergeRefs } from 'react-merge-refs';
import FocusTrap from 'focus-trap-react';
import { useMeasure } from 'react-use';

import { alpha } from '@mui/system';
import { Theme, useTheme, useThemeProps } from '@mui/material/styles';

import { DialogSlots } from '@mui/material';

import { Box } from '@mui/material';
import { Fade } from '@mui/material';
// import { Collapse } from '@mui/material';
import { DialogTitle } from '@mui/material';
import { Backdrop } from '@mui/material';
import { IconButton } from '@mui/material'
import { TouchRippleActions } from '@mui/material';

import { ModalProps } from '@mui/material';
import { DialogProps } from '@mui/material';
// import { type BackdropProps } from '@mui/material';
import { type TransitionProps } from '@mui/material/transitions';

// import { Popper, PopperProps } from '@mui/material';

import { Paper, PaperProps } from '@mui/material';

import Draggable, {
  DraggableEventHandler, DraggableEvent, DraggableData
} from 'react-draggable';

import { Point, Size, CommonUtils } from '@sheetxl/utils';

import {
  useCallbackRef, useImperativeElement, KeyCodes, useFullscreenPortal, DynamicIcon, ShowWindowOptions
} from '@sheetxl/utils-react';

import { ExhibitTooltip } from '../button';
import { scrollbarTheming } from '../theme';

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
    if (!titleSize || !rootSize) return null;
    return {
      left: 0,
      top: 0,
      right: rootSize.width - titleSize.width,
      bottom: rootSize.height - titleSize.height
    }
  }, [titleSize, rootSize]);

  const [position, setPosition] = useState(null);
  const [boundedPosition, setBoundedPosition] = useState(null);

  /*
   * We have to track the relative position from the start
   */
  const [offset, setOffset] = useState<Point>(null);

  useLayoutEffect(() => {
    if (position || !defaultPosition) return;
    setPosition(defaultPosition ?? ZERO_POINT);
  }, [defaultPosition]);

  useEffect(() => {
    if (!dragBounds || !position) return;
    // reposition within bounds
    setBoundedPosition({
      x: Math.max(0, Math.min(position.x, dragBounds.right)),
      y: Math.max(0, Math.min(position.y, dragBounds.bottom))
    });
  }, [position, dragBounds]);

  return (
    <Draggable
      nodeRef={refLocal}
      handle={handleSel}
      cancel={'[class*="MuiDialogContent-root"]'}
      position={boundedPosition}
      // position={position}
      bounds={dragBounds ?? '.MuiModal-root'}
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
        const x = event.clientX ?? event.touches?.[0]?.clientX;
        const y = event.clientY ?? event.touches?.[0]?.clientY;
        setPosition({ x: x - offset.x, y: y - offset.y });
        // console.log('onDrag', x, y, offset);
        //  setPosition({ x: data.x, y: data.y });
      }}
    >
      <PaperComponent
        ref={mergeRefs([refLocal, refForwarded]) as React.RefObject<HTMLDivElement>}
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
  const defaultTransitionDuration = {
    enter: theme.transitions.duration.enteringScreen * 0.66,
    exit: theme.transitions.duration.leavingScreen * 0.66,
  };

  const {
    title='SheetXL',
    key='draggable-window',
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

  const refFocusTrap = useRef<FocusTrap>(null);
  const [initialPosition, setInitialPosition] = useState<Point>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(false);

  const refRipple = useRef<TouchRippleActions>(null);

  const [refRootMeasure, rootRect] = useMeasure<HTMLElement>();
  const refWindowLocal = useRef<HTMLDivElement>(null);
  const [refTitleMeasure, titleRect] = useMeasure<HTMLElement>();

  const refPaperComponent = useRef<any>(null);

  useEffect(() => {
    if (!initialPosition) return;
    setVisible(open);
  }, [open, initialPosition]);

  const handleCancel = useCallbackRef(() => {
    onCancel?.();
    setVisible(false);
  }, [onCancel]);

  useEffect(() => {
    // We fire only once. After observers have found the bounds
    if ((rootRect.width === 0 && rootRect.height === 0) || initialPosition) return;
    const paperBounds = refPaperComponent.current?.getBoundingClientRect();

    const remainingHeight = rootRect.height - paperBounds.height;
    const remainingWidth = rootRect.width - paperBounds.width;
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
  }, [rootRect, titleRect]);

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [lastFocus, setLastFocus] = useState<HTMLElement>(null);
  const [relatedFocus, setRelatedFocus] = useState<HTMLElement>(null);

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

  const transitionProps:TransitionProps = {
    ...propTransitionProps,
    onExited: (node: HTMLElement) => {
      onDone?.(null);

      propTransitionProps?.onExited?.(node);
    },
    onExit: (node: HTMLElement) => {
      const closureRelatedFocus = relatedFocus;
      if (closureRelatedFocus) {
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


  let elemWindow = (
    <FocusTrap
      focusTrapOptions={{
        escapeDeactivates: false,
        allowOutsideClick: true,
        initialFocus: false
      }}
      ref={refFocusTrap}
      active={active}
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
            ref={mergeRefs([refPaperComponent, refForwarded]) as React.RefObject<HTMLDivElement>}
            className={clsx({
              'Mui-focusVisible': hasFocus,
            }, propClassName, 'draggable')}
            // @ts-ignore
            sx={{
              "& *" : (theme: Theme) => scrollbarTheming(theme),
              pointerEvents: 'auto',
              userSelect: 'none',
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
                backgroundColor: (theme: Theme) => {
                  return alpha(theme.palette.action.hover, 0.03);
                },
              }}
              ref={refTitleMeasure}
            >
              <Box
                sx={{
                  display: 'flex',
                  flex: '1 1 10%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: (theme: Theme) => theme.spacing(1),
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
                  label={"Close"}
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
    </FocusTrap>
  );

  let backdrop = null;
  if (isModal) {
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
  return (
    createPortal(
    <Box
      className="MuiModal-root"
      sx={{
        position: 'fixed',
        zIndex: '1300', // ? what Mui uses
        right: '0',
        bottom: '0',
        top: '0',
        left: '0',
        outline: '0',
        display: 'block',
        pointerEvents: 'none'
      }}
      ref={mergeRefs([refLocal, refRootMeasure]) as React.RefObject<HTMLDivElement>}
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
        // The FocusTrap react component doesn't expose the FocusTrap instance type
        (refFocusTrap.current as any)?.focusTrap?.unpause();
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
          // if (hasFocus) {
          //   console.log('blur', refFocusTrap.current);
          // }
          // The FocusTrap react component doesn't expose the FocusTrap instance type
          (refFocusTrap.current as any)?.focusTrap?.pause();
          setHasFocus(false);
        }
      }}
    >
      {backdrop}
      {elemWindow}
    </Box>
    , getPortalContainer(), key + '')
    // </Popper>
  );
}));

export default InternalWindow;
