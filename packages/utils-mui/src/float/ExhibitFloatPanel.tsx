import React, {
  forwardRef, useRef, memo, useState, useMemo
} from 'react';

import { Theme } from '@mui/material/styles';

import { Paper } from '@mui/material';
import { BoxProps } from '@mui/material';

import { useCallbackRef } from '@sheetxl/utils-react';

import { scrollbarTheming } from '../theme/ScrollbarTheming';

import { defaultCreatePopupPanel, ExhibitPopupPanelProps } from './ExhibitPopup';
import { ExhibitPopper, ExhibitPopperProps, ExhibitPopperPosition } from './ExhibitPopper';
import { FloatReference } from './useFloatStack';

/**
 * TODO - review the usefulness of this class
 * Wraps a popper and a theme paper
 *
 * Features.
 * Callback to popupPanel closing
 *
 */
export interface  ExhibitFloatPanelProps extends BoxProps {
  open: boolean;

  floatReference?: FloatReference;

  anchorEl?: any;//React.ReactElement | VirtualElement | (() => VirtualElement);

  anchorPosition?: ExhibitPopperPosition;

  label: string;

  createPopupPanel?: (props: ExhibitPopupPanelProps) => React.ReactElement<any>;

  popperProps?: Partial<ExhibitPopperProps>;

  onClosing?: () => void;

  onClose?: () => void;

  onMount?: (element: HTMLDivElement, instance: any/*Instance*/) => void;

  onOpening?: () => void;

  onOpen?: () => void;
}

const ExhibitFloatPanel: React.FC<ExhibitFloatPanelProps & { ref?: any }> = memo(
    forwardRef<any, ExhibitFloatPanelProps>((props, refForwarded) => {
  const {
    open,
    anchorEl,
    anchorPosition,
    label,
    floatReference,
    createPopupPanel = defaultCreatePopupPanel,
    popperProps,
    onMount: propOnMount,
    onClosing: propOnClosing,
    onClose: propOnClose,
    onOpening: propOnOpening,
    onOpen: propOnOpen,
    children,
    sx: sxProps,
    ...rest
  } = props;

  // TODO - // if this is not specified perhaps we should just disable
  // if (!createPopupPanel)
  //   throw new Error('createPopupPanel is required');

  const handleClosing = useCallbackRef(propOnClosing, [propOnClosing]);
  const handleClose = useCallbackRef(propOnClose, [propOnClose]);
  const handleOpening = useCallbackRef(propOnOpening, [propOnOpening]);
  const handleOpen = useCallbackRef(propOnOpen, [propOnOpen]);

  const [popupContainer, setPopupContainer] = useState<HTMLElement>();
  const paperRef = useRef<HTMLDivElement>(null);

  const handleMount = useCallbackRef((element: HTMLDivElement, instance: any/*Instance*/) => {
    setPopupContainer(element);
    // setPopupContainer(paperRef.current);

    // TODO - review why we need to send the paper
    propOnMount?.(paperRef.current, instance);
  }, [propOnMount]);

  const popupPanel = useMemo(() => {
    // if (!isVisible) return null;
    const propsPanel:ExhibitPopupPanelProps = {
      popupContainer: popupContainer,
      floatReference,
      children: children,
      ...rest
    }

    const popupPanel = createPopupPanel(propsPanel);

    return (
      <Paper
        elevation={8}
        ref={paperRef}
        // @ts-ignore
        sx={{
          display: "flex",
          overflow: "auto",
          outline: "none",
          "&.MuiPaper-root" : (theme: Theme) => scrollbarTheming(theme),
        }}
        tabIndex={0}
      >
        {popupPanel}
     </Paper>
    )
  }, [createPopupPanel, children, popupContainer, floatReference]);

  return (
    <ExhibitPopper
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
      {...popperProps}
    >
      {popupPanel}
    </ExhibitPopper>
  );
}));

ExhibitFloatPanel.displayName = "ExhibitFloatPanel";
export { ExhibitFloatPanel };