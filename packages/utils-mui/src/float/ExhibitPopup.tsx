import React from 'react';

import clsx from 'clsx';

import { Box, type BoxProps, type Theme } from '@mui/material';
import { type TooltipProps } from '@mui/material';
import { type IconButtonProps } from '@mui/material';

// import { TouchRippleActions, TouchRippleProps } from '@mui/material';
// import { ButtonBaseProps } from '@mui/material'
import { ArrowDownIcon } from '../theme';

import { type FloatReference, type FloatPopupPanelProps, type RenderSlotFn } from '@sheetxl/utils-react';

import { type ExhibitFloatPanelProps } from './ExhibitFloatPanel';

/**
 * The {@link FloatPopupPanelProps} content fields on the MUI {@link BoxProps}
 * surface (so the default MUI panel can read `sx`/`className`/etc.). We drop the
 * neutral HTML base from `FloatPopupPanelProps` (BoxProps supplies the element
 * props, with incompatible types e.g. `color`) and keep just its content fields.
 */
export type ExhibitPopupPanelProps =
  Omit<FloatPopupPanelProps, keyof React.HTMLAttributes<HTMLDivElement>> & BoxProps;

export interface ExhibitQuickButtonProps extends IconButtonProps {
  /**
   * Tooltip title. Zero-length titles string are never displayed.
   */
   tooltip?: NonNullable<React.ReactNode>;

   /**
    * Wrap the button in a custom tooltip.
    */
   renderTooltip?: (props: ButtonTooltipRenderProps) => React.ReactNode;
}

/**
 * What a button's `renderTooltip` is handed: the MUI {@link TooltipProps} to wrap `children` in, and
 * whether the tip is suppressed.
 */
export interface ButtonTooltipRenderProps extends TooltipProps {
  /** Show no tip: the button's popup is open. Not a prop of the button itself. */
  disabled: boolean;
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
   * Render the `label` as visible button content (alongside any icon / split-toggle checkmark) rather
   * than as tooltip-only. Toolbar (icon) buttons are icon-only by default. Menu items always show the
   * label regardless.
   * @defaultValue false
   */
  showLabel?: boolean;

  /**
   * Render as selected,
   */
  selected?: boolean;

  parentFloat?: FloatReference;

  renderPopupPanel?: RenderSlotFn<ExhibitPopupPanelProps> | null;

  onPopupOpen?: () => void;

  onPopupClose?: () => void;

  propsPopup?: Partial<ExhibitFloatPanelProps>;

  /**
   * Tooltip title. Zero-length titles string are never displayed.
   */
  tooltip?: NonNullable<React.ReactNode>;

  /**
   * Wrap the button in a custom tooltip.
   */
  renderTooltip?: (props: ButtonTooltipRenderProps) => React.ReactNode;

  /**
   * If this set then the popup becomes a split button.
   */
  onQuickClick?: (e: React.MouseEvent<Element>) => void;

  propsQuickButton?: ExhibitQuickButtonProps;
  renderQuickButton?: (props: ExhibitQuickButtonProps) => React.ReactNode;

  disabled?: boolean;

  /**
   * If the icon button is a primary icon button.
   * This may change the color of the text and icon.
   * @defaultValue false
  */
  primary?: boolean;

  /**
   * A ripple surface rendered inside the executing (quick) button. Supplied by `CommandPopupButton`
   * via `useManagedRipple` — an always-mounted `TouchRipple` that can flash on any command dispatch
   * (MUI's built-in ripple is lazy-mounted and can't fire for remote executes). When set, the quick
   * button disables its own ripple and hosts this one instead.
   */
  ripple?: React.ReactNode;
}

export const defaultRenderPopupPanel = (props: ExhibitPopupPanelProps): React.ReactElement<any> => {
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
        display:'flex',
        flexDirection: 'column',
        // Vertical padding lives on the scrollable *content* (here), not the
        // scroll container (Paper): a scroll container's padding-bottom is
        // dropped by flex/older engines, so the bottom inset would vanish after
        // the last item. On content it scrolls with the items and both ends show
        // — matching how MUI's own MenuList pads the list, not the viewport.
        paddingTop: (theme: Theme) => `${theme.shape.borderRadius}px`,
        paddingBottom: (theme: Theme) => `${theme.shape.borderRadius}px`,
        ...propSx
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export const createDownArrow = (isSplit: boolean, dense: boolean, rotate: boolean) => {
  let transform: string = '';
  // if (isSplit)
  //   retValue = 'translateX(-7px)';
  // if (dense) {
  //   transform = (transform ? transform + ' ' : '') + 'scale(0.80)';
  // }
  if (rotate) {
    transform = (transform ? transform + ' ' : '') + 'rotate(180deg)';
  }
  return (
    <ArrowDownIcon
      style={{
        marginLeft: isSplit ? undefined : dense ? '-0.25rem' : '-3px',
        marginRight: isSplit ? undefined : dense ? '-0.25rem' : '-6px',
        transform
      }}
      color='inherit'
    />
  );
}