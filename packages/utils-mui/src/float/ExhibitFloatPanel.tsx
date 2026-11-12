import type React from 'react';
import {
  forwardRef, useRef, memo, useState, useMemo
} from 'react';

import { Paper } from '@mui/material';
import { type BoxProps } from '@mui/material';

import {
  useCallbackRef, RenderSlot, scrollbarThemedClassName, type RenderSlotFn
} from '@sheetxl/utils-react';

import { defaultRenderPopupPanel, type ExhibitPopupPanelProps } from './ExhibitPopup';
import {
  FloatPopper, type FloatPopperProps, type FloatPopperPosition, type FloatPanelProps
} from '@sheetxl/utils-react';

/**
 * The MUI floating surface: a {@link FloatPopper} (a positioned portal)
 * wrapping a themed {@link Paper}. This is the surface installed by
 * `ExhibitFloatProvider`; `useFloatStack` renders content into it via its
 * `renderFloatPanel`.
 *
 * Mirrors the neutral {@link FloatPanelProps}, swapping the HTML base for MUI's
 * {@link BoxProps} and re-typing the surface-specific fields
 * (`renderPopupPanel`/`propsPopper`/`anchor*`) against the MUI surface.
 */
export type ExhibitFloatPanelProps =
  Omit<FloatPanelProps,
    keyof React.HTMLAttributes<HTMLDivElement> | 'anchorEl' | 'anchorPosition' | 'renderPopupPanel' | 'propsPopper'
  > & BoxProps & {
    anchorEl?: any;//React.ReactElement | VirtualElement | (() => VirtualElement);
    anchorPosition?: FloatPopperPosition;
    renderPopupPanel?: RenderSlotFn<ExhibitPopupPanelProps> | null;
    propsPopper?: Partial<FloatPopperProps>;
  };

export const ExhibitFloatPanel = memo(forwardRef<any, ExhibitFloatPanelProps>(
  (props: ExhibitFloatPanelProps, refForwarded) => {
  const {
    open,
    anchorEl,
    anchorPosition,
    label,
    floatReference,
    renderPopupPanel = defaultRenderPopupPanel,
    propsPopper,
    onMount: propOnMount,
    onClosing: propOnClosing,
    onClose: propOnClose,
    onOpening: propOnOpening,
    onOpen: propOnOpen,
    children,
    sx: sxProps,
    ...rest
  } = props;

  const handleClosing = useCallbackRef(propOnClosing ?? (() => {}), [propOnClosing]);
  const handleClose = useCallbackRef(propOnClose ?? (() => {}), [propOnClose]);
  const handleOpening = useCallbackRef(propOnOpening ?? (() => {}), [propOnOpening]);
  const handleOpen = useCallbackRef(propOnOpen ?? (() => {}), [propOnOpen]);

  const [popupContainer, setPopupContainer] = useState<HTMLElement>();
  const paperRef = useRef<HTMLDivElement>(null);

  const handleMount = useCallbackRef((element: HTMLDivElement, instance: any/*Instance*/) => {
    setPopupContainer(element);
    // setPopupContainer(paperRef.current);

    // TODO - review why we need to send the paper
    propOnMount?.(paperRef.current!, instance);
  }, [propOnMount]);

  const popupPanel = useMemo(() => {
    // if (!isVisible) return null;
    const propsPanel:ExhibitPopupPanelProps = {
      popupContainer: popupContainer,
      floatReference,
      children: children,
      ...rest
    }

    const popupPanel = <RenderSlot render={renderPopupPanel} props={propsPanel} />;

    return (
      <Paper
        elevation={8}
        className={scrollbarThemedClassName}
        ref={paperRef}
        // @ts-ignore
        sx={{
          display: "flex",
          // Vertical scroll only. Floating panels (menus) ellipsize their content
          // and never want horizontal scrolling; allowing overflow-x produces a
          // phantom 1px horizontal scrollbar when the vertical one appears (the
          // scrollbar's arrival reflows content by a sub-pixel).
          overflowX: "hidden",
          overflowY: "auto",
          outline: "none",
          // A menu reads as "above" the app via its stated fill (`--sxl-color-elevated`) + the shadow. A
          // FLAT host whose float fill sits within a shade of what it covers needs the other half of the
          // flat idiom — an edge. `transparent` by default; the host opts in by setting the token.
          // Fallback chain, not a bare read: a float mounts in a PORTAL, so if it ever fails to carry its
          // origin's theme scope an unresolved `background-color` would render the menu transparent.
          backgroundColor: "var(--sxl-color-elevated, var(--sxl-color-base-100, #fff))",
          border: "1px solid var(--sxl-color-elevated-border, transparent)",
        }}
        tabIndex={0}
      >
        {popupPanel}
     </Paper>
    )
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

ExhibitFloatPanel.displayName = "ExhibitFloatPanel";