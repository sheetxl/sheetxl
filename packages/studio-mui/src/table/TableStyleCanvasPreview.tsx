import type React from 'react';
import { useCallback, useMemo, useState, useLayoutEffect, memo, forwardRef } from 'react';

import clsx from 'clsx';

import {
  Table, type ITable, type IStyleCollection, type ITableStyle, type Size
} from '@sheetxl/sdk';

import { useGridColorScheme } from '@sheetxl/react';

import { drawStyleSwatch, swatchSizeOf, type StyleSwatchGrid } from './_drawStyleSwatch';

// Opaque backstop for the cell "default background" (the grid window color) before it resolves / off-DOM.
// Canvas `fillStyle` CANNOT consume a raw `var()` (it silently no-ops → keeps the prior cell's pixels, the
// "colors mixing" bug), and the canvas is `{ alpha: false }` and reused, so the fill MUST be an opaque
// concrete value — hence we resolve `--sxl-color-base-100` off the (grid-surface) preview element.
const FALLBACK_GRID_FILL = '#ffffff';

export interface TableStyleCanvasPreviewProps extends React.HTMLAttributes<HTMLDivElement>  {
  table: ITable;

  tableStyle: ITableStyle;
  styles: IStyleCollection;

  disabled?: boolean;
  /**
   * If provided then this context will be used.
   */
  canvas?: HTMLCanvasElement;
  /**
   * Reference to the element.
   */
  ref?: React.Ref<HTMLDivElement>;
}

// Cross-open cache of rendered swatch images. The popup unmounts on close (FloatPopper renders
// null), so without this every open re-resolves 25 styles + repaints + re-encodes a data URL for
// each of the ~60 swatches. Keyed by the theme instance — `IStyleCollection.setTheme` replaces the
// instance, so theme switches (and GC) invalidate naturally; the entry key carries every other
// input that feeds the pixels (style name/options, custom-style definition, mode, window fill).
const swatchImageCache = new WeakMap<object, Map<string, string>>();

const rowCount = 5;
const columnCount = 5;
const swatchGrid: StyleSwatchGrid = { rows: rowCount, columns: columnCount, cellWidth: 13, cellHeight: 10 };
const { width: tableWidth, height: tableHeight } = swatchSizeOf(swatchGrid);

/**
 * This is a way to canvas based TableStylePreview. It has a simple rendering but is lightweight.
 */
export const TableStyleCanvasPreview = memo(forwardRef<HTMLDivElement, TableStyleCanvasPreviewProps>(
  (props: TableStyleCanvasPreviewProps, refForwarded) => {
  const {
    table: propTable,
    tableStyle,
    styles,
    disabled: propDisabled,
    style: propStyle,
    className: propClassName,
    canvas: propCanvas,
    ...rest
  } = props;

  // The grid body's scheme (shared source; matches the grid even though this renders in the toolbar).
  // Drives `toRGBA(darkMode)` for the style's authored colors + the window fill below.
  const gridColorScheme = useGridColorScheme();
  const darkMode = gridColorScheme === 'dark';

  // The window fill (no-fill cells) must be a concrete color for the canvas. This element declares the grid
  // surface (below), so resolve `--sxl-color-base-100` off it via getComputedStyle.
  // Resolved in a layout effect (the canvas is built during render, before the ref attaches)
  // and re-resolved on scheme change.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [gridFill, setGridFill] = useState<string | undefined>(undefined);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    setEl(node);
    if (typeof refForwarded === 'function') refForwarded(node);
    else if (refForwarded) (refForwarded as React.RefObject<HTMLDivElement | null>).current = node;
  }, [refForwarded]);
  useLayoutEffect(() => {
    if (!el) return;
    // Always a concrete value: `undefined` means "not resolved yet", which is what holds the swatch
    // back below - resolving to the fallback here would build it twice, once per key.
    setGridFill(getComputedStyle(el).getPropertyValue('--sxl-color-base-100').trim() || FALLBACK_GRID_FILL);
  }, [el, gridColorScheme]);

  const backgroundImage = useMemo(() => {
    // console.profile("_GenerateBackgroundImage");
    // console.time("_GenerateBackgroundImage");
    /* Before the layout effect has read the grid's window color there is nothing to draw AGAINST:
       building now would encode every swatch a second time, once per color, and each encode is the
       expensive part of this component. The effect runs before paint, so nothing flashes. */
    if (gridFill === undefined) return null;
    const json = propTable.toJSON();
    if (!json) return null;
    json.style = {
      ...json.style,
      name: tableStyle.getName()
    }
    const gridFillResolved = gridFill;

    const theme = styles?.getTheme();
    // Built-in style definitions are immutable so the name alone identifies them; a custom style can
    // be edited under the same name, so its definition joins the key.
    const cacheKey =
      `${JSON.stringify(json.style)}|h${json.headerRowCount ?? 0}|t${json.totalsRowCount ?? 0}` +
      `|${darkMode ? 'dark' : 'light'}|${gridFillResolved}` +
      (tableStyle.isBuiltIn() ? '' : `|${JSON.stringify(tableStyle.toJSON())}`);
    let cacheForTheme = theme ? swatchImageCache.get(theme) : undefined;
    const cached = cacheForTheme?.get(cacheKey);
    if (cached) return cached;

    const size: Size = {
      width: columnCount,
      height: rowCount
    };
    const previewTable = new Table({ size, json, styles });

    const canvas = propCanvas ?? document.createElement('canvas');
    const backgroundImage = drawStyleSwatch(
      canvas, swatchGrid, (rowIndex, colIndex) => previewTable.getStyleAt(rowIndex, colIndex), darkMode, gridFillResolved
    );
    if (!backgroundImage) return null;
    if (theme) {
      if (!cacheForTheme) {
        cacheForTheme = new Map();
        swatchImageCache.set(theme, cacheForTheme);
      }
      cacheForTheme.set(cacheKey, backgroundImage);
    }
    return backgroundImage;
  }, [propCanvas, propTable, tableStyle, styles, darkMode, gridFill]);

  return (
    <div
      ref={setRef}
      // Adopt the grid surface + its mode so `--sxl-color-base-100` (resolved above) is the grid's window
      // color — even though this preview renders in the toolbar (app surface).
      data-sxl-theme-surface="grid"
      data-sxl-theme-mode={gridColorScheme}
      className={clsx('table-style-preview', propClassName)}
      style={{
        backgroundImage: backgroundImage ?? undefined,
        width: tableWidth,
        height: tableHeight,
        ...propStyle
      }}
      {...rest}
    />
  );
}));