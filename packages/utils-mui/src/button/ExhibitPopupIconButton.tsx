import React, {
  forwardRef, memo, useMemo, useState, useRef
} from 'react';

import clsx from 'clsx';

import { alpha } from '@mui/system';
import { useTheme, Theme } from '@mui/material/styles';

import { Box, BoxProps } from '@mui/material';
import { IconButton } from '@mui/material';
import { TooltipProps } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';
import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

import { SimpleTooltip } from '../components';
import { ExhibitIconButton } from './ExhibitIconButton';

import {
  ExhibitPopupButtonProps, ExhibitQuickButtonProps, createDownArrow, useFloatStack
} from '../float';

export interface OutlineBorder {
  color?: string | ((theme: Theme) => string);
  hoverColor?: string | ((theme: Theme) => string);
  focusColor?: string| ((theme: Theme) => string);
}

export interface ExhibitPopupIconButtonProps extends ExhibitPopupButtonProps {
  dense?: boolean;
  outlined?: boolean | OutlineBorder;
  disableHover?: boolean;
  buttonProps?: BoxProps
}

// TODO - This should use the mui-state styled but I am not at all sure how to do this
const ExhibitPopupIconButton: React.FC<ExhibitPopupIconButtonProps & { ref?: any }> = memo(
    forwardRef<any, ExhibitPopupIconButtonProps>((props, refForwarded) => {
  const {
    dense=true,
    outlined: propOutlined=false,
    label: propLabel,
    selected: propSelected = false,
    onQuickClick,
    parentFloat,
    createPopupPanel,
    popupProps,
    onPopupOpen: propOnPopupOpen,
    onPopupClose: propOnPopupClose,
    quickButtonProps : propQuickButtonProps,
    createQuickButton,// : propCreateQuickButton,
    tooltip = '',
    createTooltip,
    icon: propIcon,
    disabled: propDisabled,
    buttonProps: propsButton = CommonUtils.EmptyObject,
    disableHover,
    touchRippleRef,
    primary,
    children,
    sx: propSx,
    className: propClassName,
    ...rest
  } = props;
  // TODO - // if this is not specified perhaps we should just disable
  // if (!createPopupPanel)
  //   throw new Error('createPopupPanel is required');
  // const createQuickButton = useCallback(propCreateQuickButton, [propCreateQuickButton]);

  const appTheme:Theme = useTheme();

  const colors = useMemo(() => {
    const evalColor = (key: string, theme: Theme, outlinedColor: string, defaultColor: string=outlinedColor) => {
      const color = typeof propOutlined === 'boolean' ? null : (propOutlined as OutlineBorder)[key];
      if (typeof color === "function") {
        return (color as (theme: Theme) => string)(theme);
      }
      if (color) {
        return color;
      }
      return propOutlined ? outlinedColor : defaultColor;
    }

    const outline = {
      color: (theme: Theme) => {
        return evalColor('color', theme, theme.palette.divider, 'transparent');
      },
      hoverColor: (theme: Theme) => {
        return evalColor('hoverColor', theme, theme.palette.text?.primary, theme.palette.divider);
      },
      focusColor: (theme: Theme) => {
        return evalColor('focusColor', theme, theme.palette?.primary?.main);
      }
    }
    return {
      outline,
      active: appTheme.palette.mode === 'dark' ? appTheme.palette.text.secondary : appTheme.palette.text.primary,
      text: (appTheme.palette.text as any).icon ?? appTheme.palette.action.active
    }
  }, [propOutlined, appTheme]);

  const [isOpen, setOpen] = useState<boolean>(false);

  const [isFocused, setFocused] = useState<boolean>(false);
  const [isHovered, setHovered] = useState<boolean>(false);

  const anchorRef = useRef(null);
  const popupIconRef = useRef(null);

  const movableStack = useFloatStack({
    anchor: anchorRef.current,
    label: propLabel as string,
    createPopupPanel: createPopupPanel,
    parentFloat: parentFloat,
    popperProps: popupProps?.popperProps,
    onClose: () => { setOpen(false); propOnPopupClose?.(); },
    onOpen: () => { setOpen(true); propOnPopupOpen?.(); }
  });

  const handleQuickClick = useCallbackRef((e: React.MouseEvent<any>) => {
    onQuickClick?.(e);
    movableStack.reference.close(0);
  }, [onQuickClick, movableStack]);

  const handleToggle = useCallbackRef(() => {
    if (!isOpen)
      movableStack.reference.open(0);
    else
      movableStack.reference.close(0);
  }, [isOpen, movableStack, parentFloat, propLabel]);

  const styling = useMemo(() => {
    const borderStyling = {
      '&.bordered': {
        borderWidth: '1px',
        borderRadius: '0px',
        borderTopStyle: 'solid',
        borderBottomStyle: 'solid',
        borderColor: (theme: Theme) => {
          return colors.outline.color(theme);
        },
        '&.Mui-focusVisible': {
          border: (theme: Theme) => `1px solid ${colors.outline.focusColor(theme)} !important`,
        },
        "&:hover:not(.Mui-disabled, [disabled])": {
          borderColor: () => {
            return disableHover ? 'transparent' : undefined; // Note - This is a terrible approach. styles should be additive. Revisit disableHover as it's not well supported
          },
          backgroundColor: () => {
            return disableHover ? 'transparent' : undefined; // Note - This is a terrible approach. styles should be additive. Revisit disableHover as it's not well supported
          },
        },
        '&.Mui-hovered:not(.Mui-disabled, [disabled])': {
          borderColor: (theme: Theme) => colors.outline.hoverColor(theme),
        },
        '&.Mui-selected:not(.Mui-disabled, [disabled])': {
          borderColor: (theme: Theme) => colors.outline.hoverColor(theme),
        },
        '&.left': {
          borderTopLeftRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
          borderBottomLeftRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
          borderLeftStyle: 'solid',
        },
        '&.hard-right': {
          borderRightStyle: 'solid',
          borderRightWidth: '1px',
          borderRightColor:  (theme: Theme) => {
            return colors.outline.color(theme);
          },
        },
        '&.right': {
          borderTopRightRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
          borderBottomRightRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
          borderRightStyle: 'solid',
        },
        '&.divider': {
          borderLeftWidth: '0px !important'
        },
      },
      '& .MuiTouchRipple-child': {
        // TODO - This is incorrect the ripple isn't setup correctly
        borderRadius : (theme: Theme) => `${theme.shape.borderRadius}px !important`,
      },
    }

    const menuStyling = {
      '&.Mui-selected': {
        backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
        "&:hover:not(.Mui-disabled)": {
          backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity),
          // Reset on touch devices, it doesn't add specificity
          '@media (hover: none)': {
            backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
          }
        },
      },
    }

    const buttonStyling = {
      maxHeight: `100%`,
      '&.Mui-selected': {
        // borderColor: (theme: Theme) => `${(outlined ? ((theme.palette.text as any).icon ?? theme.palette.action.active) : theme.palette.divider)}`,
        backgroundColor: (theme: Theme) => alpha(((theme.palette.text as any).icon ?? theme.palette.action.active), theme.palette.action.selectedOpacity),
        "&:hover:not(.Mui-disabled)": {
          backgroundColor: (theme: Theme) => alpha(((theme.palette.text as any).icon ?? theme.palette.action.active), theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity),
          // Reset on touch devices, it doesn't add specificity
          '@media (hover: none)': {
            backgroundColor: (theme: Theme) => alpha(((theme.palette.text as any).icon ?? theme.palette.action.active), theme.palette.action.selectedOpacity)
          }
        },
      },
      "&:hover:not(.Mui-disabled, [disabled])": {
        color: (theme: Theme) => theme.palette.text.primary,
      },
      backgroundColor: () => {
        return disableHover ? 'transparent' : undefined; // Note - This is a terrible approach. styles should be additive. Revisit disableHover as it's not well supported
      },
      color: (theme: Theme) => {
        // @ts-ignore
        return theme.palette.text.icon;// ?? theme.palette.action.active;
      },
      "&.Mui-disabled path.styled": {
        filter: 'grayscale(65%)',
        opacity: '.8'
      },
      padding: () => dense ? '2px 3px' : '7px',
      marginRight: '0'
    }

    const quickButtonStyling = CommonUtils.mergeContentful(buttonStyling, borderStyling);
    const openQuickButtonStyling = CommonUtils.mergeContentful(quickButtonStyling, menuStyling)

    const compoundStyling = CommonUtils.mergeContentful(buttonStyling, borderStyling);
    const openCompoundStyling = CommonUtils.mergeContentful(compoundStyling, menuStyling);
    return {
      quickButtonStyling,
      openQuickButtonStyling,
      compoundStyling,
      openCompoundStyling
    }
  }, [colors, disableHover]);

  const defaultTooltip = useCallbackRef((props: TooltipProps) => {
    const { children, ref, ...rest } = props;
    return (
      <SimpleTooltip ref={ref as any} {...rest} disableInteractive>
        {children}
      </SimpleTooltip>
    )
  }, []);

  const isSplit = onQuickClick || createQuickButton;
  const isSplitTooltip = isSplit && (propQuickButtonProps?.tooltip || propQuickButtonProps?.createTooltip);
  const defaultCreateQuickButton = (props: ExhibitQuickButtonProps) => {
    const { tooltip : quickTooltip, createTooltip: quickCreateTooltip, sx: sxProp, ...rest } = props;
    let quickButton = <IconButton
      sx={{
        ...sxProp
      }}
      component="div"
      {...rest}
    />;
    if (!isSplitTooltip)
      return quickButton;
    quickButton = (quickCreateTooltip ?? defaultTooltip)({
      title: !isOpen ? (quickTooltip ?? tooltip) : '',
      children: <div>{quickButton}</div>
    }, isOpen);
    return quickButton;
  }

  const buttonProps = {
    onKeyDown: (e: React.KeyboardEvent) => {
      // button prevents space so we don't check it
      // if (e.isDefaultPrevented()) return;
      if (e.keyCode === KeyCodes.Space) {
        handleToggle();
      } else if (e.keyCode === KeyCodes.F4 || e.keyCode === KeyCodes.Down) {
        movableStack.reference.open(0);
      } else if (e.keyCode === KeyCodes.Up) {
        movableStack.reference.close(0);
      }
    }
  }
  let button = <></>;
  const icon = useMemo(() => {
    return typeof propIcon === "function" ? propIcon() : propIcon ;
  }, [propIcon]);

  if (isSplit) {
    let arrowStyling = isOpen ? styling.openQuickButtonStyling : styling.quickButtonStyling;
    const quickButtonProps:ExhibitQuickButtonProps = {
      tabIndex: -1,
      disabled: propDisabled,
      size: "small",
      edge: "end",
      // onMouseDown:(e: React.MouseEvent<HTMLElement>) => e.preventDefault(),
      // onMouseUp: handleQuickClick,
      onMouseEnter: () => { movableStack.reference.parent.closeChild() },
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleQuickClick(e) },
      touchRippleRef: touchRippleRef as any,
      children: icon,
      ...propQuickButtonProps,
      className: clsx({
        ['Mui-focusVisible']: (isFocused || isOpen),
        ['Mui-selected']: propSelected,
        ['Mui-hovered']: isHovered || isOpen,//(isHovered || isOpen) && !disableHover,
        ['Mui-disabled']: propDisabled,

        'bordered': true,
        'left': true,
        'hard-right': true
      }, propQuickButtonProps?.className),
      sx: {
        ...styling.quickButtonStyling,
        height: '100%',
        ...propQuickButtonProps?.sx,
      },

    };
    const quickButton = (createQuickButton || defaultCreateQuickButton)(quickButtonProps);

    let downArrow = createDownArrow(true, dense, isOpen);
    if (isSplitTooltip)
      downArrow = (createTooltip ?? defaultTooltip)({
        title: !isOpen ? tooltip : '',
        children: downArrow
      }, isOpen);
    button = (<>
      {quickButton}
      <IconButton
        ref={popupIconRef}
        component="div"
        className={clsx({
          ['Mui-selected']: isOpen,
          ['Mui-hovered']: isHovered || isOpen, //(isHovered || isOpen) && !disableHover,
          ['Mui-disabled']: propDisabled,
          ['Mui-focusVisible']: (isFocused || isOpen),
          'bordered': true,
          'right': true,
          'divider': true
        })}
        sx={{
          paddingLeft: `${(dense) ? 0 : 2}px`,
          paddingRight: `${(dense) ? 0 : 2}px`,
          width: () => '1em',
          // flex: '1 1 100%',
          // alignSelf: 'stretch',
          ...styling.quickButtonStyling,
          ...arrowStyling
        }}
        TouchRippleProps={{
          center: false
        }}
        tabIndex={-1}
        disabled={propDisabled}
        size="small"
        edge="end"

        // onMouseDown={(e) => e.preventDefault()}
        // onMouseUp={(e) => handleToggle()}
        onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleToggle() }}
      >
        {downArrow}
      </IconButton>
    </>);
  } else {
    let compoundStyling = isOpen ? styling.openCompoundStyling : styling.compoundStyling;
    button = (
      <ExhibitIconButton
        ref={popupIconRef}
        tabIndex={-1}
        disabled={propDisabled}
        size="small"
        icon={icon}
        className={clsx({
          ['Mui-selected']: isOpen || propSelected,
          ['Mui-hovered']: isHovered,// && !disableHover,
          ['Mui-disabled']: propDisabled,
          ['Mui-focusVisible']: (isFocused || isOpen),
          'bordered': true,
          'left': true,
          'right': true,
          // 'button': true
        })}
        sx={{
          // ...dynamicStyling,
          ...styling.quickButtonStyling,
          ...compoundStyling
        }}
        // onMouseDown={(e: React.MouseEvent<HTMLElement>) => e.preventDefault()}
        // onMouseUp={(e: React.MouseEvent<HTMLElement>) => handleToggle()}
        onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleToggle() }}
      >
        { createDownArrow(false, dense, isOpen) }
      </ExhibitIconButton>
    )
  }

  const {
    className: classNameButtonProps,
    sx: sxButtonProps,
    ...restButtonProps
  } = propsButton;

  let buttonRoot = (
    <Box
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      {...buttonProps}
      aria-label="split button"
      ref={anchorRef}
      tabIndex={propDisabled ? undefined : 0}
      className={clsx(classNameButtonProps, "split-button-root", {
        ['Mui-focusVisible']: (isFocused || isOpen),
        ['Mui-selected']: isOpen || propSelected,
        ['Mui-hovered']: isHovered,// && !disableHover,
        ['Mui-disabled']: propDisabled
      })}
      sx={{
        display: 'flex',
        flex: '1 1 100%',
        alignItems: 'center',
        width: 'fit-content',
        // bgcolor: 'background.paper',
        '&:not(.Mui-disabled)': {
          cursor: 'pointer',
        },
        // border: (theme: Theme) => {
        //   return `solid ${(outlined ? theme.palette.divider : "transparent")} 1px`
        // },
        marginLeft: propOutlined ? '1px' : '0px',
        marginRight: propOutlined ? '1px' : '0px',
        borderRadius : (theme: Theme) => `${theme.shape.borderRadius}px`,
        '&.Mui-focusVisible': {
          outline: (theme: Theme) => `solid ${theme.palette.primary.main} 1px`,
          zIndex: 2, // to allow outline to be placed on top
        },

        // '& button': {
        //   marginRight: `0px`,
        //   display: 'flex',
        //   // borderRadius : 0,
        //   padding: () => dense ? '2px 3px' : '7px',
        // },
        ...sxButtonProps
      }}
      {...restButtonProps}
    >
      {button}
    </Box>
  );

  if (!isSplitTooltip) {
    buttonRoot =  (createTooltip ?? defaultTooltip)({
      title: !isOpen ? tooltip : '',
      children: buttonRoot
    }, isOpen);
  }

  return (
    <Box
      className={clsx(propClassName, "popupIconButton")}
      ref={refForwarded}
      {...rest}
      sx={{
        zIndex: (isFocused || isOpen) ? 2 : undefined, // to allow outline to be placed on top
        display: 'flex',
        alignItems: 'center',
        ...propSx
      }}
    >
      {buttonRoot}
      {movableStack.component}
    </Box>
  );
}));

ExhibitPopupIconButton.displayName = "ExhibitPopupIconButton";
export { ExhibitPopupIconButton };
