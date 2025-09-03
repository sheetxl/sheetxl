import React, { useState, useImperativeHandle, useMemo, useEffect, forwardRef, memo } from 'react';

// import maxSize from 'popper-max-size-modifier';

import { useTheme } from '@mui/material/styles';
import { Grow } from '@mui/material';
import { Popper, PopperProps } from '@mui/material';

import {
  Instance, detectOverflow
  //  VirtualElement, Options, OptionsGeneric
} from '@popperjs/core';

import { useCallbackRef, useFullscreenPortal } from '@sheetxl/utils-react';

// export { Instance, VirtualElement };

export interface ExhibitPopperPosition {
  top: number;
  left: number;
}

export interface ExhibitPopperRef {
  instance: () => Instance;
  element: () => HTMLElement;
}

const maxSize = {
  name: 'maxSize',
  enabled: true,
  phase: 'main',
  requiresIfExists: ['offset', 'preventOverflow', 'flip'],
  fn: function fn(_ref: any) {
    var state = _ref.state,
        name = _ref.name,
        options = _ref.options;
    var overflow = detectOverflow(state, options);

    var _ref2 = state.modifiersData.preventOverflow || {
      x: 0,
      y: 0
    },
        x = _ref2.x,
        y = _ref2.y;

    let _state$rects$popper = state.rects.popper;
    let width = _state$rects$popper.width;
    let height = _state$rects$popper.height;

    let _state$placement$split = state.placement.split('-');
    let basePlacement = _state$placement$split[0];

    let  widthProp = basePlacement === 'left' ? 'left' : 'right';
    let  heightProp = basePlacement === 'top' ? 'top' : 'bottom';
    state.modifiersData[name] = {
      width: width - overflow[widthProp] - x,
      height: height - overflow[heightProp] - y
    };
  }
};

/**
 * Wraps the Popper with standardized behavior.
 * A popper has 3 lifecycle states: mounted, visible, open.
 *
 *
 *
 * 1. Animation
 * 2. Resizing (see popper-max-size-modifier)
 * // TODO - fix arrow option
 *
 * // TODO - replace with useFloat and remove 'passthrough' dependency on mui
 */
export interface ExhibitPopperProps extends PopperProps {
  onClosing?: () => void;

  onClose?: () => void;

  onMount?: (element: HTMLDivElement, instance: Instance) => void; // PopperInstance

  onOpening?: () => void; // PopperInstance

  onOpen?: () => void;

  /**
   * If panel can resize on overflow. Otherwise will try to fit
   */
  resizeOnOverflow?: boolean;

  /**
   * major minor offset
   * @defaultValue 0, 2
   */
  offsets?: number[];

  anchorPosition?: ExhibitPopperPosition;

  label?: string;
  /**
   * @defaultValue false
   */
  // arrow?: boolean;
}

const defaultOffsets = [0, 2];
const ExhibitPopper: React.FC<ExhibitPopperProps & { ref?: any }> = memo(
    forwardRef<any, ExhibitPopperProps>((props, refForwarded) => {
  const {
    sx: sxProps,
    open: propOpen,
    children,
    label,
    offsets = defaultOffsets,
    // arrow = true,
    anchorEl,
    anchorPosition,
    onMount: propOnMount,
    onOpening: propOnOpening,
    onOpen: propOnOpen,
    onClosing : propOnClosing,
    onClose : propOnClose,
    resizeOnOverflow = true,
    ...rest
  } = props;
  if (Array.isArray(children))
    throw new Error('children can not be an array');

  const appTheme = useTheme();

  const applyMaxSize = {
    name: "applyMaxSize",
    enabled: true,
    phase: "beforeWrite",
    requires: ["maxSize"],
    fn({ state }) {
      const { height } = state.modifiersData.maxSize;
      state.styles.popper.maxHeight = `${height - 10}px`;
    }
  };

  const modifiers:any = useMemo(() => {
    const retValue:any = [
      {
        name: 'offset',
        options: {
          offset: offsets,
        },
      },
      {
        name: 'flip',
        enabled: true,
        options: {
          rootBoundary: 'document'
        },
      },
      // TODO - review why this option isn't working
      // {
      //   name: 'arrow',
      //   enabled: arrow,
      //   options: {
      //     element: anchorEl,
      //   },
      // },
    ];
    if (resizeOnOverflow) {
      retValue.unshift(
        maxSize,
        applyMaxSize,
      );
    };
    return retValue;
  }, [resizeOnOverflow, offsets]);

  const [isVisible, setVisible] = useState<boolean>(false);

  const refPopper = React.useRef(null);
  const handleMount = useCallbackRef(() => { // args: Partial<State>
    propOnMount?.(refFloatElement.current, refPopper.current);
  }, [propOnOpening]);

  const handleOpening = useCallbackRef(propOnOpening, [propOnOpening]);
  const handleOpen = useCallbackRef(propOnOpen, [propOnOpen]);
  const handleClosing = useCallbackRef(propOnClosing, [propOnClosing]);
  const handleClose = useCallbackRef(() => {
    setVisible(false);
    propOnClose?.();
  }, [propOnClose]);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const refFloatElement = React.useRef<HTMLDivElement>(null);
  const refIsTrulyFirst = React.useRef<boolean>(true);

  const popperOptions = useMemo(() => {
    return {
      onFirstUpdate: () => {
        if (!refIsTrulyFirst.current) return;
        setIsMounted(true);
        handleMount?.();
        refIsTrulyFirst.current = false;
      }
    };
  }, [propOpen, isVisible]);

  useEffect(() => {
    if (propOpen && isMounted) {
      handleOpening?.();
    } else if (!propOpen && isVisible) {
      handleClosing?.();
    }

    if (propOpen)
      setVisible(propOpen);
  }, [propOpen, isMounted]);

  const anchor = useMemo(() => {
    return {
      getBoundingClientRect: () => {
        if (anchorPosition) {
          return new DOMRect(
            anchorPosition?.left || 0,
            anchorPosition?.top || 0,
            0, 0
          );
        } else {
          return (anchorEl as HTMLElement).getBoundingClientRect();
        }
      },
      // contextElement : anchorEl
    }
  }, [anchorPosition, anchorEl]);

  /* Expose some methods in ref */
  useImperativeHandle(refForwarded, (): ExhibitPopperRef => {
    return {
      instance: () => {
        return refPopper.current;
      },
      element: () => {
        return refFloatElement.current;
      }
    }
  }, []);

  const { getPortalContainer } = useFullscreenPortal();

  const sx:any=useMemo(() => {
    return {
      zIndex: propOpen ? "1300" : "1299", // zIndex: '1300', // ? what Mui uses 1300 for dialogs.
      display: "flex",
      //opacity: isVisible ? '1' : '0',
      pointerEvents: (isVisible && propOpen) ? undefined : 'none',
      maxWidth: '100%',
      maxHeight: '100%',
      ...sxProps
    } // Needs to be above toolbar but below tooltip
  }, [sxProps, propOpen, isVisible]);

  // const popper = useMemo(() => {

    const popper = (
      //@ts-ignore
      <Popper
        ref={refFloatElement}
        popperRef={refPopper}
        container={getPortalContainer}
        anchorEl={anchor}
        open={isVisible}
        role={undefined}
        popperOptions={popperOptions}
        transition={true}
        //@ts-ignore
        sx={sx} // Needs to be above toolbar but below tooltip
        placement="bottom-start"
        // placement="right-start"
        // disablePortal
        modifiers={modifiers}
        {...rest}
      >
        {({ TransitionProps, placement, ...rest }) => {
          const {
            in : propsIn,
            onEnter : propsOnEnter,
            onExited : propsOnExited,
            ...restTransitionProps
          } = TransitionProps ?? {};
          return (
          <Grow
            {...restTransitionProps}
            in={propOpen}
            onEnter={() => { propsOnEnter?.(); handleOpen();}}
            onExited={() => { propsOnExited?.(); handleClose();}}
            timeout={{
              enter: appTheme.transitions.duration.shorter,//enteringScreen,
              exit: 0, //appTheme.transitions.duration.shortest, lots of flickers on exit at the moment
            }}
            style={{
              transformOrigin:
                placement === 'bottom-start' ? 'left top' : 'center bottom'
            }}
          >
            {typeof children === "function" ? children({ TransitionProps, placement, ...rest}) : (children as any || {})}
          </Grow>
          )
        }}
      </Popper>
    );
  // }, [isVisible, popperChildren]);

  return popper;
}));

ExhibitPopper.displayName = "ExhibitPopper";
export { ExhibitPopper };
