import type React from 'react';
import { memo, useEffect, useReducer } from 'react';

import { type Theme } from '@mui/material';
import { Box, Typography } from '@mui/material';

import {
  IFill, ShapeStyleUtils,
  type ICell, type IColor, type IMovable, type IShape, type IStroke, type IStyleCollection, type ITheme
} from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type MovablePaneProps, useGridColorScheme } from '@sheetxl/react';

import { FillPanel, type FillSelection, LinePanel, type LineSelection, panelSx } from '../format';

/**
 * The color the shape's line takes when it states none: its theme style's, which is what the
 * picker's **Automatic** swatch hands back. Resolved with the shape's own line left out, so it
 * answers the same while a color is stated.
 */
const themeLineColor = (shape: IShape, movable: IMovable, styles: IStyleCollection): IColor => {
  const json = shape.toJSON();
  let theme: ITheme.JSON | null = null;
  try {
    theme = styles.getTheme()?.toJSON() ?? null;
  } catch {
    theme = null;
  }
  const resolved = ShapeStyleUtils.resolve(
    json ? { ...json, stroke: undefined } : null, theme, ShapeStyleUtils.inheritedGroupFill(movable)
  );
  const fill = resolved.stroke?.fill;
  const color = fill?.type === IFill.Type.Solid ? fill.color : undefined;
  return color ? styles.parseColor(color) : styles.getNormal().getFont().getColor();
};

/** A heading over one of the tab's parts: Excel's "Fill" and "Line" under Fill & Line. */
const PartTitle = (props: { children: React.ReactNode }): React.ReactElement => (
  <Typography variant="subtitle2" component="div">{props.children}</Typography>
);

/**
 * The body of the format pane for a shape: Excel's Fill & Line, applying live to the shape.
 *
 * @remarks
 * The Fill controls are the Format Cells pane's, bound to the shape's style instead of the
 * selection's cells (see {@link FillSelection}); the Line controls are the shape's own.
 */
export const ShapeFormatPanel = memo((props: MovablePaneProps) => {
  const { movable, sheet } = props;
  const t = useTranslator();
  const shape = movable.getContent<IShape>();

  // Live apply: what the pane shows follows what it just wrote, and any other write to the shape.
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => shape.addListeners({ onAnyChange: refresh }), [shape]);

  const styles = sheet.getStyles();
  const darkMode = useGridColorScheme() === 'dark';
  const disabled = shape.isReadOnly();
  const style = shape.getStyle();

  const fill: FillSelection = {
    fill: style.getFill(),
    styles,
    schemeLookup: styles.schemeLookup(),
    darkMode,
    disabled,
    createCell: (update: ICell.Update): ICell | null => sheet.createCell(update),
    applyFill: (update: IFill.Update, description?: string): void => { style.setFill(update, { description }); },
  };

  const stroke = style.getStroke();
  const stated = style.toJSON()?.stroke ?? null;

  const line: LineSelection = {
    stroke,
    stated,
    autoColor: themeLineColor(shape, movable, styles),
    styles,
    schemeLookup: styles.schemeLookup(),
    darkMode,
    disabled,
    applyStroke: (update: IStroke.Modifiers | null, description?: string): void => { style.setStroke(update, { description }); },
  };

  // The Format Cells pane's tab strip joins once there is a second tab (Effects, Size &
  // Properties); one tab alone reads as a heading that does nothing.
  return (
    <Box sx={{ ...panelSx, gap: 2, paddingTop: (theme: Theme) => theme.spacing(1) }}>
      <PartTitle>{t('shape.pane.fill')}</PartTitle>
      <FillPanel selection={fill}/>
      <PartTitle>{t('shape.pane.line')}</PartTitle>
      <LinePanel selection={line}/>
    </Box>
  );
});

ShapeFormatPanel.displayName = 'ShapeFormatPanel';
