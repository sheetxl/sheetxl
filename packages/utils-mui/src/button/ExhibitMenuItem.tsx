import type React from 'react';
import { memo, useState, useMemo, forwardRef } from 'react';

import clsx from 'clsx';

import { DynamicIcon, useFloat } from '@sheetxl/utils-react';

import { type Theme } from '@mui/material';
import { ListItemButton, type ListItemButtonProps } from '@mui/material';
import { ListItemIcon } from '@mui/material';

import { ChipStrip } from '../components';
import { type ExhibitIconButtonProps } from './ExhibitIconButton';
import { ExhibitTooltip, type ExhibitTooltipProps } from './ExhibitTooltip';

const BLANK_ICON = <DynamicIcon/>;

/**
 * The horizontal box model of a menu row — the margins and paddings an {@link ExhibitMenuItem} sits
 * in. Exported so a row that is NOT an item (a field row, a header) can occupy the same column as the
 * items around it instead of re-deriving the numbers. Lead such a row with an empty `ListItemIcon` and
 * its content lines up past the icon gutter, where a menu item's label starts.
 */
export const MenuItemInsets = {
  marginLeft: '4px',
  marginRight: '4px',
  paddingLeft: '6px',
  paddingRight: '18px'
} as const;

export interface ExhibitMenuItemProps extends ListItemButtonProps {
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
  propsTooltip?: Omit<ExhibitTooltipProps, 'children'>;

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
    propsTooltip,
    chips,
    primary,
    ...rest
  } = props;

  // We close an open sibling submenu on hover via the enclosing float, taken
  // from context (the provider reaches us even through portals).
  const enclosingFloat = useFloat();

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
    <ListItemButton
      ref={refForwarded}
      role="menuitem"
      disabled={disabled}
      onMouseOver={(event: React.MouseEvent<HTMLDivElement>) => {
        propOnMouseOver?.(event);
        if (event.isDefaultPrevented()) return;
        setHovered(true);
      }}
      onMouseOut={(event: React.MouseEvent<HTMLDivElement>) => {
        propOnMouseOut?.(event);
        if (event.isDefaultPrevented()) return;
        setHovered(false);
      }}
      onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
        propOnMouseEnter?.(event);
        if (event.isDefaultPrevented()) return;
        enclosingFloat?.closeChild();
      }} // close any other children
      TouchRippleProps={{
        center: false
      }}
      className={clsx({
        'Mui-focusVisible': hasFocus,
        'Mui-hovered': isHovered,
      }, propClassName)}
      onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
        propOnFocus?.(e);
        setFocus(true);
      }}
      onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
        propOnBlur?.(e);
        setFocus(false);
      }}
      sx={{
        // Menu-item look, ported from the former `MuiMenuItem` theme override
        // (no longer applies now that this is a ListItemButton, not a MenuItem).
        // ListItemButton (unlike MenuItem) does not apply `typography.body1`, so
        // set the themed font explicitly or text falls back to the serif default.
        flex: '1 1 100%',
        // A menu row never wraps its label: the menu grows to the longest row. (A float whose max width
        // is capped by the overflow `size` middleware would otherwise wrap the longest label.)
        whiteSpace: 'nowrap',
        fontFamily: (theme: Theme) => theme.typography.fontFamily,
        fontWeight: 400,
        lineHeight: 1.5,
        paddingTop: '2px',
        paddingBottom: '2px',
        ...MenuItemInsets,
        borderRadius: '4px',
        fontSize: '0.875em',
        '@media (pointer: coarse)': {
          fontSize: '1em',
        },
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
    </ListItemButton>
  );

  if (propsTooltip) {
    retValue = (
    <ExhibitTooltip
      children={retValue}
      placement="right-start"
      {...propsTooltip}
    />)
  }
  return retValue;
}));