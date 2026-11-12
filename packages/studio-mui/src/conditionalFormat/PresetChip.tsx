import type React from 'react';
import { memo } from 'react';

import { Box, type SxProps, type Theme } from '@mui/material';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import { useGridColorScheme } from '@sheetxl/react';

import { GRID_CELL_BACKGROUND, GRID_LINE_COLOR, GRID_TEXT_COLOR } from './ScaleMiniGrid';

/**
 * One swatch in a preset strip, and the frame every format preview in this editor draws in.
 *
 * @remarks
 * Every tab's gallery is the same control at the same size — a dxf, a color scale, a data bar, or
 * the chip that clears — so the strips line up as the user moves between tabs. Callers paint the
 * inside; this owns the footprint, the frame and the hover.
 */
export interface PresetChipProps extends React.HTMLAttributes<HTMLElement> {
  /** Hover text. A chip whose content already names it can omit this. */
  title?: string;
  /**
   * The chip paints a CELL rather than a control.
   *
   * @remarks
   * A cell chip adopts the grid surface and the grid's own light/dark — which is not the app's,
   * *Enable Dark Grid* gates it — so its paper, its gridline frame and any `'adaptive'` color the
   * caller paints inside resolve to what the sheet will actually draw. Off (the default) the chip
   * is chrome: transparent, framed in the panel's divider, and it inherits the app's mode.
   *
   * @defaultValue false
   */
  sheet?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

export const PresetChip = memo<PresetChipProps>((props) => {
  const { title, sheet, disabled, sx, className, children, ...rest } = props;

  const gridColorScheme = useGridColorScheme();

  // A chip with nothing to invoke is a preview, not a control — it renders as a plain element so a
  // preview inside an already-clickable card does not nest a button in one. `disabled` follows the
  // element: it is an attribute a `div` does not have.
  const interactive = !!rest.onClick;

  const chip = (
    <Box
      component={interactive ? 'button' : 'div'}
      {...(interactive ? { disabled } : null)}
      className={className ? `sxl-cf-preset-chip ${className}` : 'sxl-cf-preset-chip'}
      {...(sheet ? { 'data-sxl-theme-surface': 'grid', 'data-sxl-theme-mode': gridColorScheme } : null)}
      sx={{
        width: '34px',
        height: '26px',
        padding: 0,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // The sheet's own paper and gridline — a cell chip framed in the panel's divider draws a
        // chrome-colored edge around a sheet-colored cell, which reads wrong the moment the two
        // modes differ.
        background: sheet ? GRID_CELL_BACKGROUND : 'none',
        color: sheet ? GRID_TEXT_COLOR : undefined,
        border: (theme: Theme) => `1px solid ${sheet ? GRID_LINE_COLOR : theme.palette.divider}`,
        borderRadius: 1,
        fontSize: '12px',
        lineHeight: 1,
        ...(interactive
          ? { cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }, '&:disabled': { cursor: 'default' } }
          : null),
        ...sx
      }}
      {...rest}
    >
      {children}
    </Box>
  );

  // A disabled button fires no events, so the tooltip listens on a wrapper instead of the chip.
  return title
    ? (
      <SimpleTooltip disableInteractive title={title}>
        <Box component="span" sx={{ display: 'inline-flex', flex: '0 0 auto' }}>{chip}</Box>
      </SimpleTooltip>
    )
    : chip;
});

PresetChip.displayName = 'PresetChip';
