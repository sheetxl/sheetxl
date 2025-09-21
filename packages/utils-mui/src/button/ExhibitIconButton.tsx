import React, { useState, memo, forwardRef, useMemo } from 'react';

import clsx from 'clsx';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';
import { IconButton, IconButtonProps } from '@mui/material';
import { Box } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';

import { DynamicIcon } from '@sheetxl/utils-react';

import { ExhibitTooltip, ExhibitTooltipProps } from './ExhibitTooltip';

import { FloatReference } from '../float/useFloatStack';
import { SimpleTooltip } from '../components';

const BLANK_ICON = <DynamicIcon/>;
const DEFAULT_TOGGLE_ICON = <DynamicIcon iconKey="Check"/>;

export interface ExhibitIconButtonProps extends IconButtonProps {
  dense?: boolean;
  outlined?: boolean;
  icon?: React.ReactNode | (() => React.ReactNode);
  disableHover?: boolean;
  /**
   * If the icon button is a primary icon button.
   * This may change the color of the text and icon.
   * @defaultValue false
  */
  primary?: boolean;
  /**
   * If set to a `boolean` the button will act like a toggle.
   */
  selected?: boolean | null;
  /**
   * Tooltip properties. If this is specified then the tooltips are used.
   * Do not provide a child as this component will be the child.
   */
  tooltipProps?: Omit<ExhibitTooltipProps, 'children'>;

  parentFloat?: FloatReference;
}

/**
 * This is a simple styled icon button.
 */
export const ExhibitIconButton: React.FC<ExhibitIconButtonProps & { ref?: any }> = memo(
  forwardRef<any, ExhibitIconButtonProps>((props, refForwarded) => {
  const {
    dense=true,
    outlined=false,
    disableHover=false,
    parentFloat,
    selected = undefined,
    icon: propIcon,
    tooltipProps,
    children,
    primary,
    sx: propSx,
    disabled: disabledProp,
    className: propClassName,
    onFocus: propOnFocus,
    onBlur: propOnBlur,
    ...rest
  } = props;

  // mui doesn't restore Mui-focusVisible class when focus is lost/regained programmatically.
  const [hasFocus, setFocus] = useState<boolean>(false);

  const style = {
    marginRight: '0px',
    padding: dense ? '2px' : '7px',
    borderRadius : (theme: Theme) => {
      return `${theme.shape.borderRadius}px`
    },
    color: (theme: Theme) => {
      return !primary ? ((theme.palette.text as any).icon ?? theme.palette.action.active) : undefined; // default
    },
    border: (theme: Theme) => {
      return `solid ${(outlined ? theme.palette.divider : "transparent")} 1px`
    },
    '& .MuiTouchRipple-child': {
      borderRadius : (theme: Theme) => `${theme.shape.borderRadius}px !important`
    },
    '&.Mui-selected': {
      backgroundColor: (theme: Theme) => {
        return alpha(theme.palette.text.primary, theme.palette.action.selectedOpacity);
      },
      border: (theme: Theme) => {
        return `solid ${(outlined ? theme.palette.text?.primary : theme.palette.divider)} 1px`
      }
    },
    '&.Mui-disabled': {
      border: (theme: Theme) => {
        return `solid ${(outlined ? theme.palette.divider : 'transparent' )} 1px`
      },
    },
    "&.Mui-disabled > .icon path": {
      filter: 'grayscale(65%)',
      opacity: '.8'
    },
    // "&:hover:not([disabled])": {
    //   backgroundColor: 'transparent'
    // },
    '&.Mui-focusVisible': {
      outline: `solid transparent 1px`,
      border: `1px solid transparent`
    },
    ...propSx
  };

  const hoverStyling = {
    "&:hover:not(.Mui-disabled, [disabled])": {
      color: (theme: Theme) => theme.palette.text.primary,
      border: (theme: Theme) => {
        return `solid ${(outlined ? theme.palette.text?.primary : theme.palette.divider)} 1px`
      },
      '&.Mui-selected': {
        backgroundColor: (theme: Theme) => {
          return alpha(theme.palette.text.primary, theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity);
        }
      },
      '> .outline-hover': {
        outline: (theme: Theme) => {
          return `solid ${(outlined ? theme.palette.text?.primary : theme.palette.divider)} 1px`
        }
      },
      backgroundColor: null
    },

    '&.Mui-focusVisible': {
      outline: (theme: Theme) => `solid ${theme.palette.primary.main} 1px`,
      border: (theme: Theme) => `1px solid ${theme.palette?.primary?.main}`,
      zIndex: 1 // to allow outline to be placed on top
    }
  }

  let buttonStyling = style;
  if (!disableHover) {
    buttonStyling = CommonUtils.mergeContentful(style, hoverStyling);
  }

  const icon = useMemo(() => {
    let retValue = typeof propIcon === "function" ? propIcon() : propIcon;
    if (retValue === null) return retValue;
    if (retValue) {
      return retValue;
    }
    return (selected === undefined) ? BLANK_ICON : DEFAULT_TOGGLE_ICON;
  }, [propIcon, selected]);

  let retValue = (
    <IconButton
      component="div"
      ref={refForwarded}
      className={clsx({
        'Mui-focusVisible': hasFocus,
        'Mui-selected': selected,
        'Mui-disabled': disabledProp,
      }, propClassName)}
      onFocus={(event: React.FocusEvent<HTMLButtonElement>) => {
        setFocus(true);
        propOnFocus?.(event);
      }}
      onBlur={(event: React.FocusEvent<HTMLButtonElement>) => {
        setFocus(false);
        propOnBlur?.(event);
      }}
      size="small"
      // component={compElement}
      TouchRippleProps={{
        center: false
      }}
      // focusRipple={true} // not supported for popup.
      sx={buttonStyling}
      edge="end"
      {...rest}
      disabled={disabledProp || false}
    >
      {icon}
      {children}
    </IconButton>
  );
  if (tooltipProps) {
    if (tooltipProps.simple && tooltipProps.label && !tooltipProps.disabled) {
      const { // strip out specific props
        label,
        description,
        maxWidth,
        shortcut,
        useModifierSymbols,
        componentDisabled,
        simple,
        chips,
        ref, // Remove ref to avoid conflicts
        ...simpleProps
      } = tooltipProps;
    retValue = (
      <SimpleTooltip
        disableInteractive
        title={label ?? ''}
        {...simpleProps}
      >
        <Box
          sx={{
            display: 'flex'
          }}
        >
          {retValue}
        </Box>
      </SimpleTooltip>
    );
    } else {
      retValue = (
        <ExhibitTooltip
          children={retValue}
          {...tooltipProps}
        />
      )
    }
  }
  return retValue;
}));