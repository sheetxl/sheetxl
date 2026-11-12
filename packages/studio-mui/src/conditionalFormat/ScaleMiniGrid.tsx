import type React from 'react';
import { Fragment, memo } from 'react';

import { Box } from '@mui/material';

import { Color, type IConditionalFormat, type IWorkbook } from '@sheetxl/sdk';

import { useGridColorScheme } from '@sheetxl/react';

import { toPreviewColor } from './previewColor';

/**
 * The grid's own paper, gridline and bar colors — the tokens the sheet paints with, resolved from
 * the grid surface this preview adopts rather than from the chrome around it.
 */
export const GRID_CELL_BACKGROUND = 'var(--sxl-color-base-100, rgb(255, 255, 255))';
export const GRID_LINE_COLOR = 'var(--sxl-color-base-300, rgb(224, 224, 224))';
export const GRID_ACCENT_COLOR = 'var(--sxl-color-primary, rgb(33, 115, 70))';
export const GRID_TEXT_COLOR = 'var(--sxl-color-base-content, rgba(0, 0, 0, 0.87))';
export const GRID_ERROR_COLOR = 'var(--sxl-color-error, rgb(211, 47, 47))';

/**
 * Rows the scale previews paint.
 *
 * @remarks
 * Five, because a color scale's authored stops then land on real rows — a 3-stop scale puts its
 * minimum on row 1, its midpoint on row 3 and its maximum on row 5, with an interpolated row
 * between each pair. Any even count would show the midpoint nowhere.
 */
export const SCALE_PREVIEW_ROWS = 5;

const hex2 = (v: number): string => Math.round(v).toString(16).padStart(2, '0');

/**
 * The mixed color as the grid would paint it.
 *
 * @remarks
 * A color scale reaches the sheet as an ordinary solid cell fill, and the fill layer emits every
 * color `'adaptive'` — so in a dark grid the band is the color put through the dark transform, not
 * the authored one. Interpolating and stopping at `rgb(...)` would preview a light-grid band under
 * a dark one; the mix goes back through {@link Color} so it carries the same `light-dark()` the
 * cell does.
 */
const toBandCSS = (red: number, green: number, blue: number): string =>
  new Color(`#${hex2(red)}${hex2(green)}${hex2(blue)}`).toCSS('adaptive');

/**
 * The color a scale lands on at `t` (0 = first stop, 1 = last), interpolated in straight RGB
 * between the two stops it falls between — the same mix that bands a cell.
 */
const sampleScale = (
  stops: readonly IConditionalFormat.ColorScaleStop[],
  t: number,
  fallback: string,
  workbook: IWorkbook | null
): string => {
  if (stops.length === 0) return fallback;
  const rgbAt = (i: number) => toPreviewColor(stops[i].color, workbook)?.toRGBA() ?? null;
  if (stops.length === 1) {
    const only = rgbAt(0);
    return only ? toBandCSS(only.red, only.green, only.blue) : fallback;
  }
  const position = t * (stops.length - 1);
  const lower = Math.min(Math.floor(position), stops.length - 2);
  const fraction = position - lower;
  const from = rgbAt(lower);
  const to = rgbAt(lower + 1);
  if (!from || !to) return fallback;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * fraction);
  return toBandCSS(mix(from.red, to.red), mix(from.green, to.green), mix(from.blue, to.blue));
};

/**
 * A color scale banded across the preview's rows, minimum on top — the order its stops are
 * authored in.
 *
 * @remarks
 * With five rows a 3-stop scale lands its minimum, midpoint and maximum on rows 1, 3 and 5, and
 * interpolates the two between.
 */
export const colorScaleRows = (
  stops: readonly IConditionalFormat.ColorScaleStop[],
  fallback: string,
  workbook: IWorkbook | null = null
): React.ReactNode[] =>
  Array.from({ length: SCALE_PREVIEW_ROWS }, (_, i: number) => (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: sampleScale(stops, i / (SCALE_PREVIEW_ROWS - 1), fallback, workbook)
    }} />
  ));

/**
 * Bar lengths the data-bar preview draws, as a percent of the cell — one per row.
 *
 * @remarks
 * Deliberately not a ramp: a monotonic staircase reads as a chart, while an unsorted spread reads
 * as data, which is what a data bar rule is for. Two rows share the longest bar so the effect of
 * moving the maximum bound shows on more than one row.
 */
const BAR_WIDTHS: readonly number[] = [70, 100, 20, 50, 90];

/**
 * A data bar drawn on each of the preview's rows, honoring the rule's fill, border, gradient and
 * direction.
 *
 * @remarks
 * The bar runs to the cell's own edge — a bar is drawn against the gridline in the sheet, and at
 * preview scale even a pixel of inset costs more of the bar than it buys in breathing room.
 */
export const dataBarRows = (
  scale: IConditionalFormat.DataBar,
  color: string,
  borderColor?: string
): React.ReactNode[] => {
  const rightToLeft = scale.direction === 'rightToLeft';
  return BAR_WIDTHS.map((widthPct: number) => (
    <Box sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: rightToLeft ? 'flex-end' : 'flex-start'
    }}>
      <Box sx={{
        width: `${widthPct}%`,
        height: '100%',
        // The outline counts INSIDE the height, or the bar outgrows its row.
        boxSizing: 'border-box',
        background: scale.solidFill
          ? color
          : `linear-gradient(to ${rightToLeft ? 'left' : 'right'}, ${color}, transparent)`,
        border: `1px solid ${borderColor ?? color}`,
        borderRadius: '1px'
      }} />
    </Box>
  ));
};

export interface ScaleMiniGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * What each row paints in the wide middle column, top row first. One entry per row.
   */
  rows: readonly React.ReactNode[];
}

/**
 * A few cells of sheet with the rule painted into them — three columns, the middle one wide, and
 * one row per sample.
 *
 * @remarks
 * The narrow outer columns are the point: a scale rendered as a bare gradient bar reads as a
 * legend, while the same colors banded across cells with untouched neighbors read as what the
 * sheet will actually look like. It is also the truth — cells take discrete colors, not a
 * continuous ramp.
 *
 * Frameless and unsized: it fills whatever it is dropped into, and the rows split that height
 * evenly, so the caller sets one number — the preview's height — and the grid follows.
 */
export const ScaleMiniGrid = memo<ScaleMiniGridProps>((props) => {
  const { rows, ...rest } = props;

  // This is a few cells of SHEET, drawn in the chrome. It adopts the grid surface (and the grid's
  // own light/dark, which is not the app's — *Enable Dark Grid* gates it) so its paper, gridlines
  // and any `auto` color resolve to what the sheet will actually paint.
  const gridColorScheme = useGridColorScheme();

  // Grid lines belong BETWEEN cells; the caller's frame draws the outside, so the last column and
  // last row skip theirs rather than doubling it.
  const cellSx = (row: number, col: number) => ({
    borderRight: col < 2 ? 1 : 0,
    borderBottom: row < rows.length - 1 ? 1 : 0,
    borderColor: GRID_LINE_COLOR,
    minWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center'
  });

  return (
    <Box
      className="sxl-cf-scale-mini-grid"
      data-sxl-theme-surface="grid"
      data-sxl-theme-mode={gridColorScheme}
      sx={{
        display: 'grid',
        backgroundColor: GRID_CELL_BACKGROUND,
        gridTemplateColumns: '10% 80% 10%',
        // `1fr` per row, not a fixed height — the rows are a share of the frame, so resizing the
        // preview resizes them. `minmax(0, 1fr)` because a grid track's default `auto` floor lets
        // a row refuse to shrink below its content.
        gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
        width: '100%',
        height: '100%'
      }}
      {...rest}
    >
      {rows.map((row: React.ReactNode, i: number) => (
        <Fragment key={i}>
          <Box sx={cellSx(i, 0)} />
          <Box sx={cellSx(i, 1)}>{row}</Box>
          <Box sx={cellSx(i, 2)} />
        </Fragment>
      ))}
    </Box>
  );
});

ScaleMiniGrid.displayName = 'ScaleMiniGrid';
