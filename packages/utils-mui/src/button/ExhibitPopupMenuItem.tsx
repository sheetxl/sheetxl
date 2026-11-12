import type React from 'react';
import {
  forwardRef, useMemo, memo, useState, useRef, useCallback
} from 'react';

import clsx from 'clsx';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Divider } from '@mui/material'
import { ListItemButton } from '@mui/material';

import { ArrowRightIcon } from '../theme';

import { useCallbackRef, useFloatStack, RenderSlot, type FloatPopperProps } from '@sheetxl/utils-react';

import {
  type ExhibitQuickButtonProps, type ExhibitFloatPanelProps, type ExhibitPopupButtonProps,
  type ButtonTooltipRenderProps
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
    // Menu items always render their label as text; `showLabel` is a toolbar-only concern. Strip it so
    // it doesn't spread onto a DOM node (React would warn about an unknown attribute).
    showLabel: _showLabel,
    onQuickClick,
    parentFloat,
    renderPopupPanel,
    propsPopup = PropsEmptyPopup,
    onPopupOpen: propOnPopupOpen,
    onPopupClose: propOnPopupClose,
    propsQuickButton: propsQuickButton,
    renderQuickButton,// : propCreateQuickButton,
    tooltip: _tooltipProp = '',
    renderTooltip,
    icon,
    disabled: propDisabled,
    ripple,
    primary,
    children,
    sx: propSx,
    ...rest
  } = props;

  // TODO - // if this is not specified perhaps we should just disable
  // if (!renderPopupPanel)
  //   throw new Error('renderPopupPanel is required');
  // const renderQuickButton = useCallback(propCreateQuickButton, [propCreateQuickButton]);

  const [isOpen, setOpen] = useState<boolean>(false);

  const [isFocused, setFocused] = useState<boolean>(false);
  const [isHovered, setHovered] = useState<boolean>(false);

  // prevent flickering of tooltips
  const [isArrowHovered, setArrowHovered] = useState<boolean>(false);

  const anchorRef = useRef(null);

  const popupIconRef = useRef(null);

  const localPropsPopper: Partial<FloatPopperProps> | undefined = useMemo(() => {
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
    renderPopupPanel: renderPopupPanel,
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

  const defaultTooltip = useCallback((props: ButtonTooltipRenderProps) => {
    const { children, ref, disabled: _disabled, ...rest } = props;
    return (
      <SimpleTooltip ref={ref as any} {...rest} disableInteractive>
        {children}
      </SimpleTooltip>
    )
  }, []);

  const isSplit = onQuickClick || renderQuickButton;
  const defaultRenderQuickButton = (props: any) => {
    // TODO - types between buttons and menus are not rationalized
    const { tooltip : quickTooltip, renderTooltip: quickRenderTooltip, ...rest } = props;
    let quickButton = (
      <ExhibitMenuItem
        icon={icon}
        // Host the caller's always-mounted ripple and disable MUI's lazy one (see `useManagedRipple`).
        disableRipple={!!ripple}
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
      {ripple}
      </ExhibitMenuItem>
    );

    return quickButton;
  }

  const eventListeners = {
    onFocus: () => { setFocused(true); },
    onBlur: () => setFocused(false),

    onMouseOver: () => { setHovered(true); },
    onMouseLeave: () => { setHovered(false); },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      // Opening our own submenu already closes sibling submenus. preventDefault
      // signals ExhibitMenuItem to skip its leaf-style closeChild, which would
      // otherwise immediately close the submenu we are opening.
      e.preventDefault();
      floatStack.reference.open();
    },
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault() },
    // onMouseUp: (e) => setOpen(false)
  }

  let button = <></>;
  if (isSplit) {
    const localPropsQuickButton:ExhibitQuickButtonProps = {
      tabIndex: -1,
      disabled: propDisabled,
      onMouseEnter: () => { floatStack.reference.parent?.closeChild() },
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleQuickClick(e) },
      className: clsx('quick-left', {
        // ['Mui-selected']: isOpen,
        // ['Mui-hovered']: isHovered',
      }, propsQuickButton?.className),
      // onMouseUp: handleQuickClick,
      ...propsQuickButton
    };
    const quickButton = <RenderSlot render={renderQuickButton ?? defaultRenderQuickButton} props={localPropsQuickButton} />;
    button = (<>
      {quickButton}
      <Divider sx={{ ml: '0px', mr: '0px' }} orientation="vertical" variant="middle" flexItem />
      <ListItemButton
        ref={popupIconRef}
        className={clsx({
          ['Mui-selected']: isOpen,
          ['Mui-hovered']: isHovered,
        })}
        sx={{
          borderTopLeftRadius: '0px',
          borderBottomLeftRadius: '0px',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
          padding: '0',
          paddingTop: '2px',
          paddingBottom: '2px',
          marginLeft: '0px',
          marginRight: '6px',
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
      </ListItemButton>
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
  const isSplitTooltip = isSplit && !isArrowHovered && (propsQuickButton?.tooltip || propsQuickButton?.renderTooltip);
  if (isSplitTooltip) {
    buttonRoot = <RenderSlot render={propsQuickButton?.renderTooltip ?? defaultTooltip} props={{
      title: !isOpen ? (buttonRoot ?? propsQuickButton?.tooltip) : '',
      children: buttonRoot,
      disabled: isOpen
    }} />;
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
