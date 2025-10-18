import React, {
  forwardRef, useMemo, memo, useState, useRef, useCallback
} from 'react';

import clsx from 'clsx';

import { Theme } from '@mui/material/styles';
// import { useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Divider } from '@mui/material'
import { MenuItem } from '@mui/material';
import { type TooltipProps } from '@mui/material';

import { ArrowRightIcon } from '../theme';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  useFloatStack,
  type ExhibitQuickButtonProps, type ExhibitFloatPanelProps, type ExhibitPopperProps, type ExhibitPopupButtonProps
} from '../float';
import { SimpleTooltip } from '../components';

import { ExhibitMenuItem } from './ExhibitMenuItem';

export interface ExhibitPopupMenuItemProps extends ExhibitPopupButtonProps {
  // TODO - These are not supported at the moment
  // dense?: boolean;
  // outlined?: boolean;

}

const PropsEmptyPopup: Partial<ExhibitFloatPanelProps> = {};

// TODO - This should use the mui-state styled but I am not at all sure how to do this
export const ExhibitPopupMenuItem: React.FC<ExhibitPopupMenuItemProps & { ref?: any }> = memo(
    forwardRef<any, ExhibitPopupMenuItemProps>((props, refForwarded) => {
  const {
    // dense=true,
    // outlined=false,
    selected: propSelected = false,
    label: propLabel,
    onQuickClick,
    parentFloat,
    createPopupPanel,
    propsPopup = PropsEmptyPopup,
    onPopupOpen: propOnPopupOpen,
    onPopupClose: propOnPopupClose,
    propsQuickButton: propsQuickButton,
    renderQuickButton,// : propCreateQuickButton,
    tooltip: _tooltipProp = '',
    createTooltip,
    icon,
    disabled: propDisabled,
    touchRippleRef,
    primary,
    children,
    sx: propSx,
    ...rest
  } = props;

  // TODO - // if this is not specified perhaps we should just disable
  // if (!createPopupPanel)
  //   throw new Error('createPopupPanel is required');
  // const renderQuickButton = useCallback(propCreateQuickButton, [propCreateQuickButton]);

  const [isOpen, setOpen] = useState<boolean>(false);

  const [isFocused, setFocused] = useState<boolean>(false);
  const [isHovered, setHovered] = useState<boolean>(false);

  // prevent flickering of tooltips
  const [isArrowHovered, setArrowHovered] = useState<boolean>(false);

  const anchorRef = useRef(null);

  const popupIconRef = useRef(null);

  const localPropsPopper:Partial<ExhibitPopperProps> = useMemo(() => {
    if (!propsPopup) return;
    const {
      propsPopper: popperProps,
      // ...popupPropsRest
     } = propsPopup;

    return {
      placement:"right-start",
      offsets: [-4, -2],
      ...popperProps
    }
  }, [propsPopup]);

  const floatStack = useFloatStack({
    anchor: anchorRef.current,
    label: propLabel as string,
    createPopupPanel: createPopupPanel,
    parentFloat: parentFloat,
    propsPopper: localPropsPopper,
    onClose: () => { setOpen(false); propOnPopupClose?.(); },
    onOpen: () => { setOpen(true); propOnPopupOpen?.(); }
    // ...popupPropsRest
  });

  const handleQuickClick = useCallbackRef((e: React.MouseEvent<any>) => {
    if (e.button !== 0) return;
    onQuickClick?.(e);
    floatStack.reference.close(0);
  }, [onQuickClick]);

  const arrowIcon = (
    <ArrowRightIcon
      // style={{
      //   transform: () => {
      //     let retValue = undefined;
      //     // if (isOpen)
      //     //   retValue = (retValue ? retValue + " " : "") + 'rotate(180deg)';
      //     return retValue;
      //   }
      // }}
    />
  );

  const dynamicStyling = {
    '&.Mui-selected': {
      color:  (theme: Theme) => theme.palette.text.primary,
      "& svg * ": {
        color:  (theme: Theme) => theme.palette.text.primary
      },
    }
  }

  const defaultTooltip = useCallback((props: TooltipProps) => {
    const { children, ref, ...rest } = props;
    return (
      <SimpleTooltip ref={ref as any} {...rest} disableInteractive>
        {children}
      </SimpleTooltip>
    )
  }, []);

  const isSplit = onQuickClick || renderQuickButton;
  const defaultCreateQuickButton = (props: any) => {
    // TODO - types between buttons and menus are not rationalized
    const { tooltip : quickTooltip, createTooltip: quickCreateTooltip, ...rest } = props;
    let quickButton = (
      <ExhibitMenuItem
        icon={icon}
        className={clsx({
          ['Mui-hovered']: isHovered,
        })}
        sx={{
          flex: '1 1 100%',
          ...dynamicStyling
        }}
        {...rest}
      >
      {propLabel}
      </ExhibitMenuItem>
    );

    return quickButton;
  }

  const eventListeners = {
    onFocus: () => { setFocused(true); },
    onBlur: () => setFocused(false),

    onMouseOver: () => { setHovered(true); },
    onMouseLeave: () => { setHovered(false); },
    onMouseEnter: () => { floatStack.reference.open() },
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault() },
    // onMouseUp: (e) => setOpen(false)
  }

  let button = <></>;
  if (isSplit) {
    const localPropsQuickButton:ExhibitQuickButtonProps = {
      tabIndex: -1,
      disabled: propDisabled,
      onMouseEnter: () => { floatStack.reference.parent.closeChild() },
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleQuickClick(e) },
      className: clsx('quick-left', {
        // ['Mui-selected']: isOpen,
        // ['Mui-hovered']: isHovered',
      }, propsQuickButton?.className),
      // onMouseUp: handleQuickClick,
      ...propsQuickButton
    };
    const quickButton = (renderQuickButton || defaultCreateQuickButton)(localPropsQuickButton);
    button = (<>
      {quickButton}
      <Divider sx={{ ml: '0px', mr: '0px' }} orientation="vertical" variant="middle" flexItem />
      <MenuItem
        ref={popupIconRef}
        className={clsx({
          ['Mui-selected']: isOpen,
          ['Mui-hovered']: isHovered,
        })}
        sx={{
          borderTopLeftRadius: '0px',
          borderBottomLeftRadius: '0px',
          paddingLeft: '0px',
          paddingRight: '0px',
          marginLeft: '0px',
          color: (theme: Theme) => {
            return !primary ? theme.palette.text.secondary : undefined; // default
          },
          "&.Mui-hovered:not(.Mui-disabled, [disabled])": {
            color: (theme: Theme) => theme.palette.text.primary,
          },
          ...dynamicStyling
        }}
        tabIndex={-1}
        disabled={propDisabled}
        {...eventListeners}
      >
        <Box
          className="expand-icon"
          sx={{
            flex: 'none',
            display: 'flex',
            border: '1px solid transparent',
            paddingTop: '1px', // needed to align with select icon. revisit
            paddingBottom: '1px', // needed to align with select icon. revisit
            color: (theme: Theme) => {
              return !primary ? ((theme.palette.text as any).icon ?? theme.palette.action.active) : undefined; // default
            },
          }}
          onMouseOver={(e) => { e.preventDefault(); setArrowHovered(true); }}
          onMouseLeave={() => { setArrowHovered(false); }}
          onClick={(e) => {
            e.preventDefault();
            if (isOpen)
              floatStack.reference.close();
            else
              floatStack.reference.open();
          }}
        >
          { arrowIcon }
        </Box>
      </MenuItem>
    </>);
  } else {
    button = (
      <ExhibitMenuItem
        ref={popupIconRef}
        tabIndex={-1}
        disabled={propDisabled}
        icon={icon}
        className={clsx({
          ['Mui-selected']: isOpen || propSelected,
          ['Mui-hovered']: isHovered,
        })}
        sx={{
          flex: '1 1 100%',
          paddingRight: '0px',
          ...dynamicStyling
        }}
        onClick={(e) => {
          e.preventDefault();
          if (isOpen)
            floatStack.reference.close();
          else
            floatStack.reference.open();
        }}
        {...eventListeners}
      >
        <div style={{
          flex: '1 1 100%'
        }}>
          {propLabel}
        </div>
        <Box
          className="expand-icon"
          sx={{
            flex: 'none',
            display: 'flex',
            // marginRight: '6px',
            // marginLeft: '4px',
            color: (theme: Theme) => {
              return !primary ? ((theme.palette.text as any).icon ?? theme.palette.action.active) : undefined; // default
            },
          }}
        >
          {arrowIcon}
        </Box>
      </ExhibitMenuItem>
    )
  }

  let buttonRoot = (
    <Box
      aria-label="split button"
      ref={anchorRef}
      tabIndex={propDisabled ? undefined : 0}
      className={clsx({
        ['Mui-disabled']: propDisabled,
        ['Mui-selected']: isOpen,
        ['Mui-focusVisible']: (isFocused || isOpen),
        ['Mui-hovered']: (isHovered),
      })}
      sx={{
        display: 'flex',
        flex: '1 1 100%',
        alignItems: 'center',
        width: 'fit-content',
        "& .quick-left": {
          borderTopRightRadius: '0px',
          borderBottomRightRadius: '0px',
          marginRight: '-1px',
        },
        "&.Mui-disabled > .icon path": {
          filter: 'grayscale(65%)',
        },
        ...propSx
      }}
      {...rest}
    >
      {button}
    </Box>
  );

  // Menus only show a tooltip for quickButtons because they open on hover
  const isSplitTooltip = isSplit && !isArrowHovered && (propsQuickButton?.tooltip || propsQuickButton?.createTooltip);
  if (isSplitTooltip) {
    buttonRoot = (propsQuickButton?.createTooltip ?? defaultTooltip)({
      title: !isOpen ? (buttonRoot ?? propsQuickButton?.tooltip) : '',
      children: buttonRoot
    }, isOpen);
  }

  return (
    <Box
      ref={refForwarded}
      sx={{
        zIndex: (isFocused || isOpen) ? 2 : undefined, // to allow outline to be placed on top
        display: 'flex',
        ' .tooltip-wrapper': {
          display: 'flex',
          flex: '1 1 100%'
        },
      }}
    >
      {buttonRoot}
      {floatStack.component}
    </Box>
  );
}));
