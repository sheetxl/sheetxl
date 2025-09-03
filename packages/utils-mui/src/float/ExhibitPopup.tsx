import React from 'react';

import clsx from 'clsx';

import { Box, type BoxProps } from '@mui/material';
import { type TooltipProps } from '@mui/material';
import { type IconButtonProps } from '@mui/material';

// import { TouchRippleActions, TouchRippleProps } from '@mui/material';
// import { ButtonBaseProps } from '@mui/material'

// import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import { ArrowDownOutlineIcon as ArrowDropDownIcon } from '../icons';

import { type ExhibitFloatPanelProps } from './ExhibitFloatPanel';
import { FloatReference } from './useFloatStack';

export interface ExhibitPopupPanelProps extends BoxProps {
  popupContainer: HTMLElement;

  floatReference?: FloatReference;

  /**
   * When the popup panel initiates a close
   */
  closeFloat?: () => void;

  closeFloatAll?: () => void;
}

export interface ExhibitQuickButtonProps extends IconButtonProps {
  /**
   * Tooltip title. Zero-length titles string are never displayed.
   */
   tooltip?: NonNullable<React.ReactNode>;

   /**
    * Allows for custom tooltip creation
    */
   createTooltip?: (props: TooltipProps, disabled: boolean) => React.JSX.Element;
}

export const PopupAutoFocus = {
  Popup: 'popup',
  Anchor: 'anchor'
} as const;
export type PopupAutoFocus = typeof PopupAutoFocus[keyof typeof PopupAutoFocus];

export const ClosingReason = {
  ByPopup: 'popupDone',
  Cancel: 'popupCancel',
  ClickAway: 'clickAway'
} as const;
export type ClosingReason = typeof ClosingReason[keyof typeof ClosingReason];

export const PopupButtonType = {
  /**
   * Suitable for toolbars. Click to open, click to close, generally disabled as icon
   */
  Toolbar: 'toolbar',

  /**
   * Suitable for menus. HoverIn to open, hover leave to close, generally disabled as icon and text
   */
  Menuitem: 'menuitem'
} as const;
export type PopupButtonType = typeof PopupButtonType[keyof typeof PopupButtonType];

/**
 * TODO - allow popper and popup customizations similar to @mui/tooltip
 */
export interface ExhibitPopupButtonProps extends BoxProps {
  icon?: React.ReactNode | (() => React.ReactNode);
  label?: React.ReactNode;

  /**
   * Render as selected,
   */
  selected?: boolean;

  parentFloat?: FloatReference;

  createPopupPanel?: (props: ExhibitPopupPanelProps) => React.ReactElement<any>;

  onPopupOpen?: () => void;

  onPopupClose?: () => void;

  popupProps?: Partial<ExhibitFloatPanelProps>;

  /**
   * Tooltip title. Zero-length titles string are never displayed.
   */
  tooltip?: NonNullable<React.ReactNode>;

  /**
   * Allows for custom tooltip creation
   */
  createTooltip?: (props: TooltipProps, disabled: boolean) => React.JSX.Element;

  /**
   * If this set then the popup becomes a split button.
   */
  onQuickClick?: (e: React.MouseEvent<Element>) => void;

  quickButtonProps?: ExhibitQuickButtonProps;
  createQuickButton?: (props: ExhibitQuickButtonProps) => React.ReactNode;

  disabled?: boolean;

  /**
   * If the icon button is a primary icon button.
   * This may change the color of the text and icon.
   * @defaultValue false
  */
  primary?: boolean;

  /**
   * Props applied to the `TouchRipple` element.
   */
  TouchRippleProps?: Partial<any>;//TouchRippleProps>;

  /**
  * A ref that points to the `TouchRipple` element.
  */
  touchRippleRef?: React.Ref<any>;//TouchRippleActions>;
}

export const defaultCreatePopupPanel = (props: ExhibitPopupPanelProps): React.ReactElement<any> => {
  const {
    closeFloat,
    closeFloatAll,
    floatReference,
    popupContainer,
    children,
    className: propClassName,
    sx: propSx,
    ...rest
  } = props;
  return (
    <Box
      className={clsx('menu', propClassName)}
      sx={{
        // paddingTop: (theme: Theme) => {
        //   return `${theme.shape.borderRadius}px`;
        // },
        // paddingBottom: (theme: Theme) => {
        //   return `${theme.shape.borderRadius}px`;
        // },
        display:'flex',
        flexDirection: 'column',
        ...propSx
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export const createDownArrow = (isSplit: boolean, dense: boolean, rotate: boolean) => {
  return (
    <ArrowDropDownIcon
      sx={{
        marginLeft: isSplit ? undefined : dense ? '-5px' : '-3px',
        marginRight: isSplit ? undefined : dense ? '-5px' : '-6px',
        transform: () => {
          let retValue: string | undefined = undefined;
          // if (isSplit)
          //   retValue = 'translateX(-7px)';
          if (dense)
            retValue = (retValue ? retValue + ' ' : '') + 'scale(0.8)';
          if (rotate)
            retValue = (retValue ? retValue + ' ' : '') + 'rotate(180deg)';
          return retValue;
        }
      }}
      color='inherit'
    />
  );
}