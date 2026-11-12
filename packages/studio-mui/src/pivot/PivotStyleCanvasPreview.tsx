import type React from 'react';
import { useCallback, useMemo, useState, useLayoutEffect, memo, forwardRef } from 'react';

import clsx from 'clsx';

import {
  pivotStylePreviewOf, type IPivotTable, type IStyleCollection, type ITableStyle
} from '@sheetxl/sdk';

import { useGridColorScheme } from '@sheetxl/react';

// By module: the swatch drawing is shared with the table gallery's.
import { drawStyleSwatch, swatchSizeOf, type StyleSwatchGrid } from '../table/_drawStyleSwatch';

// The window color before it resolves; a canvas fill must be an opaque concrete value (see
// `TableStyleCanvasPreview`).
const FALLBACK_GRID_FILL = '#ffffff';

export interface PivotStyleCanvasPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A pivot table style; `null` for the gallery's None, a table with no style. */
  tableStyle: ITableStyle | null;
  styles: IStyleCollection;
  /** Which parts of the style show; absent, those Excel gives a new pivot table. */
  options?: IPivotTable.StyleOptions;
  /**
   * How many rows the swatch has: Excel online's has 5, Excel desktop's 8.
   * @defaultValue 8
   */
  rows?: number;
  /** If provided then this canvas is drawn on. */
  canvas?: HTMLCanvasElement;
  ref?: React.Ref<HTMLDivElement>;
}

// Rendered swatches across opens, keyed by the theme instance (see `TableStyleCanvasPreview`).
const swatchImageCache = new WeakMap<object, Map<string, string>>();

/**
 * The swatch's cells (`pivotStylePreviewOf`), as wide as a table style's; a taller swatch has
 * shorter cells, so 8 rows are about as tall as Excel desktop's.
 */
const swatchGridOf = (rows: number): StyleSwatchGrid => ({ rows, columns: 5, cellWidth: 13, cellHeight: rows > 5 ? 7 : 10 });

/**
 * A canvas swatch of a pivot table style as Excel's gallery draws one: a header row, subheadings
 * with two items each, the grand total row, and the grand total column.
 */
export const PivotStyleCanvasPreview = memo(forwardRef<HTMLDivElement, PivotStyleCanvasPreviewProps>(
  (props: PivotStyleCanvasPreviewProps, refForwarded) => {
  const {
    tableStyle,
    styles,
    options,
    rows = 8,
    style: propStyle,
    className: propClassName,
    canvas: propCanvas,
    ...rest
  } = props;

  const gridColorScheme = useGridColorScheme();
  const darkMode = gridColorScheme === 'dark';

  // The window fill, resolved off this element, which declares the grid surface.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [gridFill, setGridFill] = useState<string | undefined>(undefined);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    setEl(node);
    if (typeof refForwarded === 'function') refForwarded(node);
    else if (refForwarded) (refForwarded as React.RefObject<HTMLDivElement | null>).current = node;
  }, [refForwarded]);
  useLayoutEffect(() => {
    if (!el) return;
    setGridFill(getComputedStyle(el).getPropertyValue('--sxl-color-base-100').trim() || FALLBACK_GRID_FILL);
  }, [el, gridColorScheme]);

  const backgroundImage = useMemo(() => {
    if (gridFill === undefined) return null;
    const { name: _name, ...flags } = options ?? {};
    const theme = styles?.getTheme();
    const cacheKey =
      `${tableStyle?.getName() ?? ''}|${options ? JSON.stringify(flags) : 'new'}|${rows}|${darkMode ? 'dark' : 'light'}|${gridFill}` +
      (!tableStyle || tableStyle.isBuiltIn() ? '' : `|${JSON.stringify(tableStyle.toJSON())}`);
    let cacheForTheme = theme ? swatchImageCache.get(theme) : undefined;
    const cached = cacheForTheme?.get(cacheKey);
    if (cached) return cached;

    const preview = pivotStylePreviewOf(styles, tableStyle, options ? flags : undefined, rows);
    const canvas = propCanvas ?? document.createElement('canvas');
    const image = drawStyleSwatch(
      canvas, swatchGridOf(preview.rows), (rowIndex, colIndex) => preview.getStyleAt(rowIndex, colIndex), darkMode, gridFill
    );
    if (!image) return null;
    if (theme) {
      if (!cacheForTheme) {
        cacheForTheme = new Map();
        swatchImageCache.set(theme, cacheForTheme);
      }
      cacheForTheme.set(cacheKey, image);
    }
    return image;
  }, [propCanvas, tableStyle, styles, options, rows, darkMode, gridFill]);

  const { width: swatchWidth, height: swatchHeight } = swatchSizeOf(swatchGridOf(Math.max(3, Math.floor(rows))));

  return (
    <div
      ref={setRef}
      data-sxl-theme-surface="grid"
      data-sxl-theme-mode={gridColorScheme}
      className={clsx('pivot-style-preview', propClassName)}
      style={{
        backgroundImage: backgroundImage ?? undefined,
        width: swatchWidth,
        height: swatchHeight,
        ...propStyle
      }}
      {...rest}
    />
  );
}));

PivotStyleCanvasPreview.displayName = 'PivotStyleCanvasPreview';
