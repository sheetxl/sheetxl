import React, { memo, useState, useMemo, forwardRef } from 'react';

import clsx from 'clsx';

import { DynamicIcon } from '@sheetxl/utils-react';

import { Theme } from '@mui/material/styles';

import { MenuItem, MenuItemProps } from '@mui/material';
import { ListItemIcon } from '@mui/material';

import { ChipStrip } from '../components';
import { ExhibitIconButtonProps } from './ExhibitIconButton';
import { ExhibitTooltip, ExhibitTooltipProps } from './ExhibitTooltip';

import { FloatReference } from '../float/useFloatStack';

const BLANK_ICON = <DynamicIcon/>;

export interface ExhibitMenuItemProps extends MenuItemProps {
  icon?: React.ReactNode | (() => React.ReactNode);

  renderIcon?: (props: ExhibitIconButtonProps) => React.ReactElement;

  /**
   * If the icon button is a secondary text button.
   * Change the color of the text and icon.
   * @defaultValue false
  */
  primary?: boolean;

  /**
   * Tooltip properties. If this is specified then the tooltips are used.
   * Do not provide a child as this component will be the child.
   */
  tooltipProps?: Omit<ExhibitTooltipProps, 'children'>;

  parentFloat?: FloatReference;

  chips?: string | string[] | React.ReactNode | React.ReactNode[];
}

const defaultRenderIcon = (props: ExhibitIconButtonProps):React.ReactElement => {
  return props.icon as React.ReactElement;
}

export const ExhibitMenuItem: React.FC<ExhibitMenuItemProps & { ref?: any }> = memo(
  forwardRef<any, ExhibitMenuItemProps>((props, refForwarded) => {
  const {
    icon = BLANK_ICON,
    renderIcon = defaultRenderIcon,
    parentFloat,
    className: propClassName,
    onFocus: propOnFocus,
    selected,
    onBlur: propOnBlur,
    onMouseOver: propOnMouseOver,
    onMouseOut: propOnMouseOut,
    onMouseEnter: propOnMouseEnter,
    disabled,
    children,
    sx: propSx,
    tooltipProps,
    chips,
    primary,
    ...rest
  } = props;

  const [hasFocus, setFocus] = useState<boolean>(false);
  const [isHovered, setHovered] = useState<boolean>(false);

  const listIcon = useMemo(() => {
    const wrappedIcon = renderIcon?.({ icon, disabled, selected });
    return wrappedIcon ? (
      <ListItemIcon
        className={clsx({
          'Mui-focusVisible': hasFocus,
          'Mui-hovered': isHovered,
        })}
        sx={{
          "& .MuiSvgIcon-root": {
            color: (theme: Theme) => {
              return !primary ? ((theme.palette.text as any).icon ?? theme.palette.action.active) : undefined; // default
            }
          },
          "&.Mui-hovered:not(.Mui-disabled, [disabled])": {
            "& .MuiSvgIcon-root": {
              color: (theme: Theme) => theme.palette.text.primary,
            }
          }
        }}
      >
        {wrappedIcon}
      </ListItemIcon>
    ) : null;
  }, [renderIcon, disabled, icon, hasFocus, isHovered, primary, selected]);


  let retValue = (
    <MenuItem
      ref={refForwarded}
      // size="small"
      // component={compElement}
      disabled={disabled}
      onMouseOver={(event: React.MouseEvent<HTMLLIElement>) => {
        propOnMouseOver?.(event);
        if (event.isDefaultPrevented()) return;
        setHovered(true);
      }}
      onMouseOut={(event: React.MouseEvent<HTMLLIElement>) => {
        propOnMouseOut?.(event);
        if (event.isDefaultPrevented()) return;
        setHovered(false);
      }}
      onMouseEnter={(event: React.MouseEvent<HTMLLIElement>) => {
        propOnMouseEnter?.(event);
        if (event.isDefaultPrevented()) return;
        parentFloat?.closeChild();
      }} // close any other children
      TouchRippleProps={{
        center: false
      }}
      className={clsx({
        'Mui-focusVisible': hasFocus,
        'Mui-hovered': isHovered,
      }, propClassName)}
      onFocus={(event: React.FocusEvent<HTMLLIElement>) => {
        propOnFocus?.(event);
        setFocus(true);
      }}
      onBlur={(event: React.FocusEvent<HTMLLIElement>) => {
        propOnBlur?.(event);
        setFocus(false);
      }}
      sx={{
        flex: '1 1 100%',
        "&.Mui-disabled > .icon path": {
          filter: 'grayscale(65%)',
        },
        '&.Mui-selected': {
          color:  (theme: Theme) => theme.palette.text.primary
        },
        color: (theme: Theme) => {
          return theme.palette.text.secondary;
        },
        "&.Mui-hovered:not(.Mui-disabled, [disabled])": {
          color: (theme: Theme) => theme.palette.text.primary,
        },
        ...propSx
      }}
      {...rest}
    >
      {listIcon}
      {children}
      {chips ? <ChipStrip chips={chips}/> : null}
    </MenuItem>
  );

  if (tooltipProps) {
    retValue = (
    <ExhibitTooltip
      children={retValue}
      placement="right-start"
      {...tooltipProps}
    />)
  }
  return retValue;
}));