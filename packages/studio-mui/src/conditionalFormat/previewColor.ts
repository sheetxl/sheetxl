import { useCallback, useReducer } from 'react';

import { Color, type IColor, type IWorkbook } from '@sheetxl/sdk';

import { themeSurfaceProps, type ThemeMode } from '@sheetxl/utils-react';

import { useModelListener, useGridColorScheme, useWorkbook } from '@sheetxl/react';

import { type ColorPanelProps } from '../color';

/**
 * Resolves an authored rule color for on-screen preview.
 *
 * @remarks
 * A rule's colors are authored strings that may reference the workbook theme
 * (`'accent1 eTint 0.4'`, `'dk1'`) or the legacy indexed palette — those only resolve against the
 * workbook's own lookups, never as bare CSS.
 *
 * @returns `null` for unresolvable input, so callers keep their fallback.
 */
export const toPreviewColor = (
  color: IColor.Serializable | null | undefined,
  workbook: IWorkbook | null | undefined
): IColor | null => {
  if (!color) return null;
  const styles = workbook?.getStyles();
  try {
    return new Color(color as any, styles?.schemeLookup(), styles?.indexedLookup());
  } catch {
    return null;
  }
};

/**
 * The workbook-derived pieces every color control in the editor needs, live across a theme swap.
 *
 * @remarks
 * A {@link Color} resolves its scheme reference when it is built, so every swatch here is a
 * snapshot. Swapping the workbook theme mutates nothing on the rule, so the panels' own
 * `onAnyChange` subscription never fires and those snapshots outlive a theme the grid has already
 * repainted for — the `onThemeChange` subscription is what retires them.
 *
 * @remarks
 * The workbook and its `schemeLookup` are both identity-stable ACROSS a theme change — they read
 * the new theme through, they are not replaced — so neither can carry the change into a
 * `useMemo`/`useCallback`. `themeKey` is the dependency that moves; put it in the deps of anything
 * that caches a resolved color.
 *
 * @remarks
 * Every color in this editor previews the GRID, not the chrome around it, so the light/dark intent
 * is the grid's own (`useGridColorScheme` — the app can be dark while *Enable Dark Grid* is off)
 * and every picker adopts `data-sxl-theme-surface="grid"`. That is what `propsColorPanel` carries;
 * spread it into a picker's `propsPanel` and pass `darkMode` to the button beside it.
 *
 * @remarks
 * `schemeLookup` rides along in `propsColorPanel`. Without one a `ColorPanel` falls back to the
 * *default* Office palette, so its theme row offers colors this workbook does not have — and
 * picking one stores a scheme reference that resolves to something else against the real theme.
 */
export const usePreviewColors = (): {
  workbook: IWorkbook | null;
  schemeLookup: IColor.SchemeLookup | undefined;
  themeKey: number;
  gridColorScheme: ThemeMode;
  darkMode: boolean;
  toColor: (color: IColor.Serializable | null | undefined) => IColor | null;
  propsColorPanel: Partial<ColorPanelProps>;
} => {
  const workbook = useWorkbook();
  const gridColorScheme = useGridColorScheme();
  const darkMode = gridColorScheme === 'dark';
  const [themeKey, bumpThemeKey] = useReducer((key: number): number => key + 1, 0);
  useModelListener<IWorkbook, IWorkbook.IListeners>(
    workbook!,
    { onThemeChange: () => bumpThemeKey() },
    // No initial fire — a theme is only interesting once it CHANGES, and seeding would cost every
    // mount a second render.
    { ignoreModelChange: true }
  );

  const toColor = useCallback((color: IColor.Serializable | null | undefined): IColor | null => {
    return toPreviewColor(color, workbook);
  }, [workbook, themeKey]);

  const schemeLookup = workbook?.getStyles().schemeLookup();
  return {
    workbook,
    schemeLookup,
    themeKey,
    gridColorScheme,
    darkMode,
    toColor,
    propsColorPanel: {
      schemeLookup,
      darkMode,
      // The popup is portaled out of the panel. Rather than re-establishing the grid's
      // `--sxl-sys-color-*` as concrete values, its root ADOPTS the grid surface, and the scoped
      // tokens resolve `auto`/system swatches from the cascade.
      ...themeSurfaceProps('grid', gridColorScheme)
    }
  };
};
