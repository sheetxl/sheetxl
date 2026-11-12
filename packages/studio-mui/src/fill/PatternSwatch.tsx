import type React from 'react';
import { memo, useMemo } from 'react';

import clsx from 'clsx';

import { IFill, type ICell, type IColor } from '@sheetxl/sdk';

/**
 * A pattern fill's stored `foreground`/`background` from its colors as Excel's Format Cells dialog
 * names them — Pattern Color (the marks) and Background Color (behind the marks).
 *
 * @remarks
 * The two agree for every tile but `solid`. A solid tile is all background in the dialog, but the
 * file format paints `solid` with `fgColor`, so Excel stores the dialog's Background in
 * `foreground` and its Pattern Color in `background`. The swap is its own inverse: pass a stored
 * fill's slots to get the dialog's colors back.
 */
export function toPatternSlots<C>(
  patternType: IFill.BuiltInSheetPattern,
  patternColor: C,
  background: C
): { foreground: C, background: C } {
  return patternType === IFill.BuiltInSheetPattern.Solid
    ? { foreground: background, background: patternColor }
    : { foreground: patternColor, background };
}

export interface PatternSwatchProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The tile to draw. */
  patternType: IFill.BuiltInSheetPattern;
  /** The color of the tile's marks — Excel's Pattern Color. */
  foreground?: IColor.Serializable | null;
  /** The color behind the marks — Excel's Background Color, and all of a `solid` tile. */
  background?: IColor.Serializable | null;
  /**
   * Mints the cell the pattern CSS is read from — the model owns the tile geometry, so a swatch
   * without a workbook to ask has nothing to draw.
   */
  createCell: (update: ICell.Update) => ICell | null;
  /** Whether to bake the colors for a dark surface. */
  darkMode?: boolean;
}

/**
 * One pattern tile, drawn exactly as the grid draws it.
 *
 * @remarks
 * The tile geometry lives in the SDK (`IFill.toCSS` bakes it into a repeating SVG data-URI), so
 * this asks the model for a pattern fill's CSS rather than keeping a second, drifting copy of the
 * twenty-odd Excel tiles. That makes it generic: any `BuiltInSheetPattern` with any two colors,
 * whether it is a menu swatch, a preview, or a legend.
 */
export const PatternSwatch = memo((props: PatternSwatchProps) => {
  const {
    patternType,
    foreground,
    background,
    createCell,
    darkMode = false,
    className: propClassName,
    style: propStyle,
    ...rest
  } = props;

  const css = useMemo(() => {
    const slots = toPatternSlots(patternType, foreground, background);
    const cell = createCell({
      style: {
        fill: {
          type: IFill.Type.Pattern,
          patternType,
          foreground: slots.foreground ?? undefined,
          background: slots.background ?? undefined
        }
      }
    });
    return cell?.getStyle().getFill().toCSS(darkMode) ?? {};
  }, [patternType, foreground, background, createCell, darkMode]);

  return (
    <div
      className={clsx('sxl-pattern-swatch', propClassName)}
      style={{
        width: '100%',
        height: '100%',
        ...css,
        ...propStyle
      }}
      {...rest}
    />
  );
});

PatternSwatch.displayName = 'PatternSwatch';

/**
 * The patterns Excel offers in Format Cells → Fill → Pattern Style, in Excel's own grid order (left
 * to right, top to bottom, six to a row): solid and the grays darkest first, then the dark
 * stripes, then the thin ones.
 *
 * @remarks
 * `Solid` leads, as in Excel: a tile that is all background color (see {@link toPatternSlots}).
 * `None` is omitted — it is a fill type in this model, not a tile. `Custom` is omitted because
 * there is nothing to draw until custom tiles land.
 */
export const PATTERN_GALLERY: readonly IFill.BuiltInSheetPattern[] = Object.freeze([
  IFill.BuiltInSheetPattern.Solid,
  IFill.BuiltInSheetPattern.DarkGray,
  IFill.BuiltInSheetPattern.MediumGray,
  IFill.BuiltInSheetPattern.LightGray,
  IFill.BuiltInSheetPattern.Gray125,
  IFill.BuiltInSheetPattern.Gray0625,
  IFill.BuiltInSheetPattern.DarkHorizontal,
  IFill.BuiltInSheetPattern.DarkVertical,
  IFill.BuiltInSheetPattern.DarkDown,
  IFill.BuiltInSheetPattern.DarkUp,
  IFill.BuiltInSheetPattern.DarkGrid,
  IFill.BuiltInSheetPattern.DarkTrellis,
  IFill.BuiltInSheetPattern.LightHorizontal,
  IFill.BuiltInSheetPattern.LightVertical,
  IFill.BuiltInSheetPattern.LightDown,
  IFill.BuiltInSheetPattern.LightUp,
  IFill.BuiltInSheetPattern.LightGrid,
  IFill.BuiltInSheetPattern.LightTrellis
]);
