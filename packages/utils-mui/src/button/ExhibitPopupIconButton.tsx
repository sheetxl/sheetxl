import type React from 'react';
import {
  forwardRef, memo, useMemo, useState, useRef
} from 'react';

import clsx from 'clsx';

import { alpha } from '@mui/system';
import { useTheme, type Theme } from '@mui/material';
import { Box, type BoxProps } from '@mui/material';
import { IconButton } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';
import { useCallbackRef, KeyCodes, useFloatStack, DynamicIcon, RenderSlot } from '@sheetxl/utils-react';

import { SimpleTooltip } from '../components';
import { ExhibitIconButton } from './ExhibitIconButton';
import { composeButtonContent } from './ButtonContent';

import {
  createDownArrow,
  type ExhibitPopupButtonProps, type ExhibitQuickButtonProps, type ButtonTooltipRenderProps
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
  propsButton?: BoxProps
}

// TODO - This should use the mui-state styled but I am not at all sure how to do this
export const ExhibitPopupIconButton: React.FC<ExhibitPopupIconButtonProps & { ref?: any }> = memo(
    forwardRef<any, ExhibitPopupIconButtonProps>((props, refForwarded) => {
  const {
    dense = true,
    outlined: propOutlined = false,
    label: propLabel,
    showLabel: propShowLabel = false,
    selected: propSelected = false,
    onQuickClick,
    parentFloat,
    renderPopupPanel,
    propsPopup,
    onPopupOpen: propOnPopupOpen,
    onPopupClose: propOnPopupClose,
    propsQuickButton,
    renderQuickButton,// : propCreateQuickButton,
    tooltip = '',
    renderTooltip,
    icon: propIcon,
    disabled: propDisabled,
    propsButton = CommonUtils.EmptyObject,
    disableHover,
    ripple,
    primary,
    children,
    sx: propSx,
    className: propClassName,
    ...rest
  } = props;
  // TODO - // if this is not specified perhaps we should just disable
  // if (!renderPopupPanel)
  //   throw new Error('renderPopupPanel is required');
  // const renderQuickButton = useCallback(propCreateQuickButton, [propCreateQuickButton]);

  const appTheme:Theme = useTheme();

  const colors = useMemo(() => {
    const evalColor = (key: string, theme: Theme, outlinedColor: string, defaultColor: string=outlinedColor) => {
      const color = typeof propOutlined === 'boolean' ? null : (propOutlined as OutlineBorder)[key as keyof OutlineBorder];
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

  const floatStack = useFloatStack({
    anchor: anchorRef.current,
    label: propLabel as string,
    renderPopupPanel: renderPopupPanel,
    parentFloat: parentFloat,
    propsPopper: propsPopup?.propsPopper,
    onClose: () => { setOpen(false); propOnPopupClose?.(); },
    onOpen: () => { setOpen(true); propOnPopupOpen?.(); }
  });

  const handleQuickClick = useCallbackRef((e: React.MouseEvent<any>) => {
    onQuickClick?.(e);
    floatStack.reference.close(0);
  }, [onQuickClick, floatStack]);

  const handleToggle = useCallbackRef(() => {
    if (!isOpen)
      floatStack.reference.open(0);
    else
      floatStack.reference.close(0);
  }, [isOpen, floatStack, parentFloat, propLabel]);

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
        // MUI gives an IconButton its hover fill only while its own ripple is enabled; the quick part
        // disables it to host the managed ripple, so the fill is stated here for both parts.
        ...(disableHover ? null : {
          backgroundColor: (theme: Theme) => alpha(theme.palette.action.active, theme.palette.action.hoverOpacity),
          '@media (hover: none)': { backgroundColor: 'transparent' }
        })
      },
      backgroundColor: () => {
        return disableHover ? 'transparent' : undefined; // Note - This is a terrible approach. styles should be additive. Revisit disableHover as it's not well supported
      },
      color: (theme: Theme) => {
        // @ts-ignore
        return theme.palette.text.icon;// ?? theme.palette.action.active;
      },
      "&.Mui-disabled > .icon path": {
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

  const defaultTooltip = useCallbackRef((props: ButtonTooltipRenderProps) => {
    const { children, ref, disabled: _disabled, ...rest } = props;
    return (
      <SimpleTooltip ref={ref as any} {...rest} disableInteractive>
        {children}
      </SimpleTooltip>
    )
  }, []);

  const isSplit = onQuickClick || renderQuickButton;
  const isSplitTooltip = isSplit && (propsQuickButton?.tooltip || propsQuickButton?.renderTooltip);
  const defaultRenderQuickButton = (props: ExhibitQuickButtonProps) => {
    const { tooltip : quickTooltip, renderTooltip: quickRenderTooltip, sx: sxProp, ...rest } = props;
    let quickButton = <IconButton
      sx={{
        ...sxProp
      }}
      component="div"
      {...rest}
    />;
    if (!isSplitTooltip)
      return quickButton;
    quickButton = <RenderSlot render={quickRenderTooltip ?? defaultTooltip} props={{
      title: !isOpen ? (quickTooltip ?? tooltip) : '',
      children: <div>{quickButton}</div>,
      disabled: isOpen
    }} />;
    return quickButton;
  }

  const buttonProps = {
    onKeyDown: (e: React.KeyboardEvent) => {
      // button prevents space so we don't check it
      // if (e.isDefaultPrevented()) return;
      if (e.keyCode === KeyCodes.Space) {
        handleToggle();
      } else if (e.keyCode === KeyCodes.F4 || e.keyCode === KeyCodes.Down) {
        floatStack.reference.open(0);
      } else if (e.keyCode === KeyCodes.Up) {
        floatStack.reference.close(0);
      }
    }
  }
  let button = <></>;
  // Compose the button's visible content — a glyph and, when `showLabel` is set, the label text:
  //   • glyph = the resolved icon, else (for a split button, which MUST keep a glyph or the quick
  //             button collapses) the toggle checkmark. `propIcon` already carries the quick command's
  //             own icon when it has one (resolved upstream), so a real icon wins over the checkmark.
  //   • label = rendered as text only when `showLabel` is set — toolbars are icon-only by default, so
  //             normal buttons keep the label as tooltip-only. `composeButtonContent` styles + lays it
  //             out (shared with `CommandButton`).
  const icon = useMemo(() => {
    const resolved = typeof propIcon === "function" ? propIcon() : propIcon;
    const glyph = resolved ?? (isSplit ? CHECK_ICON : null);
    return composeButtonContent(glyph, propShowLabel ? propLabel : null);
  }, [propIcon, propLabel, propShowLabel, isSplit]);

  if (isSplit) {
    let arrowStyling = isOpen ? styling.openQuickButtonStyling : styling.quickButtonStyling;
    const localPropsQuickButton:ExhibitQuickButtonProps = {
      tabIndex: -1,
      disabled: propDisabled,
      size: "small",
      edge: "end",
      // onMouseDown:(e: React.MouseEvent<HTMLElement>) => e.preventDefault(),
      // onMouseUp: handleQuickClick,
      onMouseEnter: () => { floatStack.reference.parent?.closeChild() },
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); handleQuickClick(e) },
      // Host the caller's always-mounted ripple and disable MUI's lazy one, so a remote execute of the
      // quick command can flash this button (see `useManagedRipple`).
      disableRipple: !!ripple,
      children: <>{icon}{ripple}</>,
      ...propsQuickButton,
      className: clsx({
        ['Mui-focusVisible']: (isFocused || isOpen),
        ['Mui-selected']: propSelected,
        ['Mui-hovered']: isHovered || isOpen,//(isHovered || isOpen) && !disableHover,
        ['Mui-disabled']: propDisabled,

        'bordered': true,
        'left': true,
        'hard-right': true
      }, propsQuickButton?.className),
      sx: {
        ...styling.quickButtonStyling,
        height: '100%',
        ...propsQuickButton?.sx,
      },

    };
    const quickButton = <RenderSlot render={renderQuickButton ?? defaultRenderQuickButton} props={localPropsQuickButton} />;

    let downArrow = createDownArrow(true, dense, isOpen);
    if (isSplitTooltip)
      downArrow = <RenderSlot render={renderTooltip ?? defaultTooltip} props={{
        title: !isOpen ? tooltip : '',
        children: downArrow,
        disabled: isOpen
      }} />;
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
          width: () => 'calc(var(--icon-size, 1.25em) * 0.8)',
          // flex: '1 1 100%',
          // alignSelf: 'stretch',
          ...styling.quickButtonStyling,
          ...arrowStyling
        }}
        TouchRippleProps={{
          center: false
        }}
        // slotProps={{
        //   touchRipple: undefined
        // }}
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
          // Fill the root when a caller widens the control (a form field rather than a toolbar
          // button); a content-sized root leaves this unchanged.
          flex: '1 1 auto',
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
        alignItems: 'stretch',
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
    buttonRoot = <RenderSlot render={renderTooltip ?? defaultTooltip} props={{
      title: !isOpen ? tooltip : '',
      children: buttonRoot,
      disabled: isOpen
    }} />;
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
      {floatStack.component}
    </Box>
  );
}));

ExhibitPopupIconButton.displayName = "ExhibitPopupIconButton";

// Fallback glyph for a split (quick command) button with no resolved icon — keeps the quick button
// visible and reflects its toggle state. Mirrors `ExhibitIconButton`'s default toggle icon.
const CHECK_ICON = <DynamicIcon iconKey="Check"/>;