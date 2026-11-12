import { useReducer } from 'react';

import { messageKey } from '@sheetxl/utils';

import {
  IBorders,
  type IWorksheet, type ICell, type ICellRange, type ICellStyle, type IStyleCollection, type IColor
} from '@sheetxl/sdk';

import { useCallbackRef, useCommands } from '@sheetxl/utils-react';

import { useModelListener, useGridColorScheme } from '@sheetxl/react';

/**
 * How a write from the pane lands on the selection: it may widen (a merge on the boundary), but the
 * grid neither takes focus nor scrolls.
 *
 * @remarks
 * The pane applies live, so a field writes on every keystroke. A plain `autoSelect: true` asks the
 * grid for focus after each write, and the rest of what the user types then goes to the cell.
 */
const PANE_SELECT: ICellRange.SelectOptions = { autoFocus: false, scrollIntoView: false };

/**
 * Everything the format panels need from the workbook, resolved from the live selection.
 *
 * @remarks
 * The panels themselves stay presentational — they read {@link style} and call {@link applyStyle}.
 * That keeps each one usable outside the task pane (a dialog, a shape inspector) by handing it a
 * different implementation of this shape.
 */
export interface FormatSelection {
  /** The sheet the selection lives on. */
  sheet: IWorksheet;
  /**
   * The ANCHOR cell — the one the panels read their control values from, and the one the preview
   * shows. A multi-cell selection has one style per cell; Excel reads the anchor too.
   */
  cell: ICell;
  /** {@link cell}'s resolved style. */
  style: ICellStyle;
  /** The workbook's style collection — theme swatches and recent colors for the pickers. */
  styles: IStyleCollection;
  /** Theme color resolution for the color pickers. */
  schemeLookup: IColor.SchemeLookup;
  /**
   * The color a border draws in when it has none of its own — the pickers' **Automatic** swatch.
   *
   * @remarks
   * The same value, from the same place, as the toolbar's border picker gets from the
   * `formatBorder` command context (see `SheetCommands`). Without it a picker has no way to offer
   * "no color of my own", and the panel has to hand it some literal color instead — which then
   * reads back as a custom swatch that the user never chose.
   */
  autoColor: IColor;
  /** Whether the GRID renders dark (not the app chrome) — previews and swatches follow the grid. */
  darkMode: boolean;
  /** True when the selection cannot be formatted (a protected sheet). */
  disabled: boolean;
  /**
   * Apply a partial style to every selected range, as one undoable step.
   *
   * @param update The style delta, or a SEQUENCE of them applied in order.
   * @param description A `messageKey('op.…')` naming the step in the undo history.
   * @param autoFit How the selection is fit afterwards, when the default style fit is not it.
   *
   * @remarks
   * A sequence is how a caller expresses REPLACE rather than merge. A style delta merges into
   * what is already there, and for a border stroke that means an absent `color` leaves the old
   * one standing — there is no value for "no color" to write. Erasing the edge first and drawing
   * it second says the whole thing, and the batch keeps it one step in the undo history.
   */
  applyStyle: (update: ICellStyle.Update | readonly ICellStyle.Update[], description?: string, autoFit?: ICellRange.AutoFitOptions) => void;
  /** Mints a detached cell for the previews (theme + named styles resolve against the workbook). */
  createCell: (update: ICell.Update) => ICell | null;
  /** Mints a detached border for the border diagram, the way the border picker's context does. */
  createBorder: (properties: Partial<IBorders.Properties>) => IBorders | null;
  /**
   * What is DRAWN on one edge of the selected block, sampled from the cell that carries it.
   *
   * @remarks
   * A range's style object is cell-shaped: `getBottom()` on it answers for the style's own cell,
   * not for the bottom of the block. So every edge is sampled from the cell it is drawn on — the
   * outer edges from the block's CORNER cells (top and left from the top-left, bottom and right
   * from the bottom-right), and each inner rule from the first cell across it: the horizontal from
   * the `top` of the cell one row down, the vertical from the `left` of the cell one column over.
   *
   * The inner rules deliberately do NOT come from `IBorders.getHorizontal`/`getVertical`. Those
   * report the RULE, which only exists while one authored block spans the whole selection: a
   * border written at any other scope splits the blocks and the rule reads `null` forever after,
   * and an imported workbook never has one at all (xlsx stores borders per cell). Read that way a
   * covered-in-lines selection reports "no inner border", so the toggle can only ever draw.
   *
   * Sampling is `direct`: a border painted by a conditional format is not something this panel can
   * clear, so counting it would make the toggle write `none` over an edge that stays on screen.
   */
  getEdgeStroke: (edge: IBorders.Edge) => IBorders.IStroke | null;
  /**
   * Whether the selection spans more than one row / column — i.e. whether it HAS an inside.
   *
   * @remarks
   * `IBorders.Edge.Horizontal` written to a single row lands nowhere: there is no shared edge to
   * put it on. The border diagram greys those targets out rather than letting a click do nothing.
   */
  hasInnerHorizontal: boolean;
  /** {@inheritDoc FormatSelection.hasInnerHorizontal} */
  hasInnerVertical: boolean;
}

/**
 * Binds the format panels to a worksheet's live selection: re-renders on a selection change and on
 * any style change (Excel-style live apply — the pane has no OK button, so what it shows must follow
 * what it just wrote).
 */
export const useFormatSelection = (sheet: IWorksheet): FormatSelection => {
  const [, forceRender] = useReducer((s: number) => s + 1, 0);

  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet, {
    onSelectionChange: () => forceRender(),
    // The coarse class event: one subscription for "the sheet may render differently", which is
    // exactly the scope of this pane.
    onStyleChange: () => forceRender()
  });

  // Protection (and any other reason formatting is unavailable) is already modeled by the format
  // commands' disable reducer — borrow its answer rather than re-deriving it here.
  const [boldCommand] = useCommands(['formatBoldToggle']);

  const gridColorScheme = useGridColorScheme();
  const cell: ICell = sheet.getSelectedCell();
  const styles: IStyleCollection = sheet.getStyles();
  const selectedRanges = sheet.getSelectedRanges();

  // Stable identities: the preview and the pattern gallery memoize the cells these mint, and a fresh
  // closure per render would rebuild every swatch's baked SVG on every keystroke in the pane.
  const applyStyle = useCallbackRef((
    update: ICellStyle.Update | readonly ICellStyle.Update[],
    description?: string,
    autoFit?: ICellRange.AutoFitOptions
  ): void => {
    const updates: readonly ICellStyle.Update[] = Array.isArray(update) ? update : [update as ICellStyle.Update];
    sheet.doBatch(
      () => {
        for (const one of updates) {
          // Re-read the selection each time: `autoSelect` can widen it (a merge on the boundary),
          // and the rest of the sequence belongs to the selection as it now stands.
          sheet.getSelectedRanges().getStyle().update(one, { autoSelect: PANE_SELECT, autoFit: autoFit ?? true });
        }
      },
      { description: description ?? messageKey('op.updateStyle') }
    );
  }, [sheet]);

  const createCell = useCallbackRef((update: ICell.Update): ICell | null => {
    return sheet.createCell(update);
  }, [sheet]);

  const createBorder = useCallbackRef((properties: Partial<IBorders.Properties>): IBorders | null => {
    return styles.getNormal().createStyle({ borders: properties as IBorders.Properties }).getBorders();
  }, [styles]);

  const bounds = selectedRanges.getCoords()[0];
  const getEdgeStroke = useCallbackRef((edge: IBorders.Edge): IBorders.IStroke | null => {
    if (!bounds) return null;
    const borderAt = (rowIndex: number, colIndex: number): IBorders => {
      return sheet.getCell({ rowIndex, colIndex }).getStyle(true).getBorders();
    };
    switch (edge) {
      case IBorders.Edge.Top: return borderAt(bounds.rowStart, bounds.colStart).getTop();
      case IBorders.Edge.Left: return borderAt(bounds.rowStart, bounds.colStart).getLeft();
      case IBorders.Edge.Bottom: return borderAt(bounds.rowEnd, bounds.colEnd).getBottom();
      case IBorders.Edge.Right: return borderAt(bounds.rowEnd, bounds.colEnd).getRight();
      // The shared edge of the first two rows / columns. A block with no inside has no such cell,
      // and `hasInnerHorizontal`/`hasInnerVertical` have already disabled those targets.
      case IBorders.Edge.Horizontal: {
        if (bounds.rowEnd <= bounds.rowStart) return null;
        return borderAt(bounds.rowStart + 1, bounds.colStart).getTop();
      }
      case IBorders.Edge.Vertical: {
        if (bounds.colEnd <= bounds.colStart) return null;
        return borderAt(bounds.rowStart, bounds.colStart + 1).getLeft();
      }
      // Every cell carries its own diagonal; the first cell speaks for the block.
      case IBorders.Edge.DiagonalUp: return borderAt(bounds.rowStart, bounds.colStart).getDiagonalUp();
      case IBorders.Edge.DiagonalDown: return borderAt(bounds.rowStart, bounds.colStart).getDiagonalDown();
      default: return null;
    }
  }, [sheet, bounds]);

  return {
    sheet,
    cell,
    style: cell.getStyle(),
    styles,
    schemeLookup: styles.schemeLookup(),
    autoColor: styles.getNormal().getFont().getColor(),
    darkMode: gridColorScheme === 'dark',
    disabled: boldCommand?.disabled() ?? false,
    applyStyle,
    createCell,
    createBorder,
    getEdgeStroke,
    hasInnerHorizontal: selectedRanges.getRowCount() > 1,
    hasInnerVertical: selectedRanges.getColumnCount() > 1
  };
};
