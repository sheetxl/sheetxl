import React, {
  forwardRef, useRef, memo, useState, useMemo
} from 'react';

import clsx from 'clsx';

import { RenderSlot, type RenderSlotFn } from '../components';
import { useCallbackRef } from '../hooks';

import {
  FloatPopper, type FloatPopperProps, type FloatPopperPosition, type FloatPopperAnchor
} from './FloatPopper';
import {
  defaultRenderFloatPopupPanel, type FloatPopupPanelProps
} from './FloatPopup';
import { type FloatReference } from './useFloatStack';

import styles from './FloatPanel.module.css';

/**
 * Props for {@link FloatPanel}.
 */
export interface FloatPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean;

  floatReference?: FloatReference;

  anchorEl?: FloatPopperAnchor;

  anchorPosition?: FloatPopperPosition;

  label?: string;

  children?: React.ReactNode;

  /** The float's content. `null` renders the card empty. */
  renderPopupPanel?: RenderSlotFn<FloatPopupPanelProps> | null;

  propsPopper?: Partial<FloatPopperProps>;

  onClosing?: () => void;

  onClose?: () => void;

  onMount?: (element: HTMLDivElement, instance: any) => void;

  onOpening?: () => void;

  onOpen?: () => void;

  ref?: React.Ref<any>;
}

/**
 * Props for {@link FloatPanelSurface}.
 */
export interface FloatPanelSurfaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  floatReference?: FloatReference;
  /** The element the float is positioned in, handed on to the content. */
  popupContainer?: HTMLElement;
  renderPopupPanel?: RenderSlotFn<FloatPopupPanelProps> | null;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The card a {@link FloatPanel} shows: the themed, scrollable surface its content is created in.
 *
 * @remarks
 * Separate from the positioning so a float positioned by something other than {@link FloatPopper}
 * (a grid float that follows its cell) wears the same card. Other attributes are handed to
 * `renderPopupPanel`, not set on the card.
 */
export const FloatPanelSurface = memo(forwardRef<HTMLDivElement, FloatPanelSurfaceProps>(
    (props: FloatPanelSurfaceProps, refForwarded) => {
  const {
    floatReference,
    popupContainer,
    renderPopupPanel = defaultRenderFloatPopupPanel,
    children,
    className: propClassName,
    ...rest
  } = props;
  const propsPanel: FloatPopupPanelProps = {
    popupContainer,
    floatReference,
    children,
    ...rest
  };
  return (
    <div
      ref={refForwarded}
      className={clsx(styles['float-panel'], propClassName)}
      tabIndex={0}
    >
      <RenderSlot render={renderPopupPanel} props={propsPanel} />
    </div>
  );
}));

FloatPanelSurface.displayName = 'FloatPanelSurface';

/**
 * A floating, anchored surface for transient content such as menus, dropdowns,
 * popovers and context menus.
 *
 * `FloatPanel` pairs a {@link FloatPopper} (which positions content next to an
 * anchor element or point, renders it in a portal, flips it to stay on screen
 * and animates it in) with a styled, scrollable "card" surface. The content of
 * that card is supplied by {@link FloatPanelProps.renderPopupPanel}.
 *
 * @remarks
 * Most consumers do not render `FloatPanel` directly — {@link useFloatStack}
 * manages instances for you, adding open/close timing, nested stacking, focus
 * handling and click-away dismissal. Reach for `FloatPanel` directly only when
 * you need a single, self-managed floating surface.
 *
 * When to use which:
 * - {@link FloatPopper} — you only need raw positioning + portal (no card chrome).
 * - `FloatPanel` / {@link useFloatStack} — interactive floating content (menus, popovers).
 *
 * The surface is theme-aware via CSS variables (e.g. `--sxl-color-base-100`),
 * so it adopts the surrounding theme without a UI-framework dependency.
 *
 * @example
 * ```tsx
 * <FloatPanel
 *   open={open}
 *   anchorEl={anchorRef.current}
 *   renderPopupPanel={() => <MyMenu />}
 * />
 * ```
 */
export const FloatPanel = memo(forwardRef<any, FloatPanelProps>(
    (props: FloatPanelProps, refForwarded) => {
  const {
    open,
    anchorEl,
    anchorPosition,
    label,
    floatReference,
    renderPopupPanel = defaultRenderFloatPopupPanel,
    propsPopper,
    onMount: propOnMount,
    onClosing: propOnClosing,
    onClose: propOnClose,
    onOpening: propOnOpening,
    onOpen: propOnOpen,
    children,
    className: propClassName,
    ...rest
  } = props;

  const handleClosing = useCallbackRef(propOnClosing ?? (() => {}), [propOnClosing]);
  const handleClose = useCallbackRef(propOnClose ?? (() => {}), [propOnClose]);
  const handleOpening = useCallbackRef(propOnOpening ?? (() => {}), [propOnOpening]);
  const handleOpen = useCallbackRef(propOnOpen ?? (() => {}), [propOnOpen]);

  const [popupContainer, setPopupContainer] = useState<HTMLElement>();
  const refPanel = useRef<HTMLDivElement>(null);

  const handleMount = useCallbackRef((element: HTMLDivElement, instance: any) => {
    setPopupContainer(element);
    propOnMount?.(refPanel.current!, instance);
  }, [propOnMount]);

  const popupPanel = useMemo(() => {
    return (
      <FloatPanelSurface
        ref={refPanel}
        className={propClassName}
        floatReference={floatReference}
        popupContainer={popupContainer}
        renderPopupPanel={renderPopupPanel}
        {...rest}
      >
        {children}
      </FloatPanelSurface>
    );
  }, [renderPopupPanel, children, popupContainer, floatReference]);

  return (
    <FloatPopper
      ref={refForwarded}
      anchorEl={anchorEl}
      anchorPosition={anchorPosition}
      label={label}
      open={open}
      onMount={handleMount}
      onOpening={handleOpening}
      onOpen={handleOpen}
      onClosing={handleClosing}
      onClose={handleClose}
      {...propsPopper}
    >
      {popupPanel}
    </FloatPopper>
  );
}));

FloatPanel.displayName = 'FloatPanel';
