import React from 'react';

import { ButtonBase, alpha, useTheme, type Theme } from '@mui/material';

import {
  OutlineGlyph, outlineLevelColors, outlineLevelTextStyle, type OutlineButtonProps, type OutlineLevelButtonProps
} from '@sheetxl/react';

import { ExhibitTooltip } from '@sheetxl/utils-mui';

/**
 * The look of the toolbar's outlined icon button (`ExhibitIconButton` with `outlined`), on a button
 * of the square the outline gives it. The size is explicit: the tooltip wraps its child in a box
 * that has no width of its own.
 */
const buttonSx = (theme: Theme, size: number): object => ({
  width: size,
  height: size,
  boxSizing: 'border-box',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: `${theme.shape.borderRadius}px`,
  color: (theme.palette.text as any).icon ?? theme.palette.action.active,
  fontFamily: theme.typography.fontFamily,
  lineHeight: 1,
  '&:hover': {
    color: theme.palette.text.primary,
    borderColor: theme.palette.text.primary
  },
  '&:active': {
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.action.selectedOpacity)
  },
  '&.Mui-disabled': {
    color: theme.palette.text.disabled,
    borderColor: theme.palette.action.disabledBackground
  }
});

/**
 * The studio's collapse / expand button for a row or column group.
 */
export const OutlineButton = (props: OutlineButtonProps): React.ReactElement => {
  const { collapsed, size, title, onToggle, disabled } = props;
  const theme = useTheme();
  return (
    <ExhibitTooltip label={title}>
      <ButtonBase
        className="outline-button"
        aria-label={title}
        aria-expanded={!collapsed}
        focusRipple={false}
        tabIndex={-1}
        disabled={disabled}
        sx={buttonSx(theme, size)}
        onClick={onToggle}
      >
        <OutlineGlyph collapsed={collapsed} size={size - 2}/>
      </ButtonBase>
    </ExhibitTooltip>
  );
};

/**
 * The studio's level button `1`..`n`: the collapse button's hover, in the corner knob's colors.
 */
export const OutlineLevelButton = (props: OutlineLevelButtonProps): React.ReactElement => {
  const { level, shown, size, title, onShowLevel, disabled } = props;
  const theme = useTheme();
  return (
    <ExhibitTooltip label={title}>
      <ButtonBase
        className="outline-level-button"
        aria-label={title}
        focusRipple={false}
        tabIndex={-1}
        disabled={disabled}
        data-shown={shown || undefined}
        sx={{ ...buttonSx(theme, size), ...outlineLevelColors, ...outlineLevelTextStyle(size) }}
        onClick={onShowLevel}
      >
        {level}
      </ButtonBase>
    </ExhibitTooltip>
  );
};
