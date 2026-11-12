import { createContext, useContext, useMemo, useRef } from 'react';

import {
  type IRange, type ICalculation, type ICellRanges, type IDataValidation, type IWorksheet
} from '@sheetxl/sdk';
import { useWorksheet } from '@sheetxl/react';

/**
 * The rule being edited, as the fields inside its editor need it. A conditional format or a data
 * validation satisfies this as it is.
 *
 * @remarks
 * A rule stores its formulas as they read at its anchor, the top-left of its ranges, but a user
 * types and reads them as they read at the ACTIVE cell, as in Excel's CF and DV dialogs. Without
 * a frame (no provider) the fields read and write the stored text unchanged.
 */
export interface FormulaFrame {
  /** The cells the rule covers, read at each conversion so an edited range is honored. */
  getRanges(): ICellRanges;
  /** The items the rule lists at a cell, for a rule that offers a list (a data validation). */
  getListItemsAt?(rowIndex: number, columnIndex: number): Promise<readonly IDataValidation.ListItem[]>;
}

/** See {@link FormulaFrame}. */
export const FormulaFrameContext = createContext<FormulaFrame | null>(null);

/** The cell a rule's formulas are typed and shown at. */
export const activeCellOf = (sheet: IWorksheet): IRange.CellCoords => {
  const { rowIndex, colIndex } = sheet.getSelectedCell().getCoords();
  return { rowIndex, colIndex };
};

/**
 * Converts between a condition's formula param and the text a field edits.
 */
export interface FormulaOptionText {
  /**
   * The formula as the field shows it, without a leading `=`.
   */
  display(formula: ICalculation.IFormula): string;
  /**
   * What was typed, as the param: a formula compiled in the editing locale, or the text itself when
   * there is no sheet to compile against.
   */
  compile(text: string): ICalculation.IFormula | string;
  /**
   * The field's home: the rule's sheet at the active cell, the frame {@link display} and
   * {@link compile} read in. A pick on that sheet writes bare, one elsewhere qualified.
   */
  home: Partial<IRange.CellCoords> | undefined;
}

/** The top-left of `ranges`, where a rule's formulas are stored. */
const anchorOf = (ranges: ICellRanges | null): IRange.CellCoords | null => {
  const coords = ranges?.getCoords() as readonly IRange.Coords[] | undefined;
  if (!coords || coords.length === 0) return null;
  let rowIndex = coords[0].rowStart;
  let colIndex = coords[0].colStart;
  for (let i=1; i<coords.length; i++) {
    rowIndex = Math.min(rowIndex, coords[i].rowStart);
    colIndex = Math.min(colIndex, coords[i].colStart);
  }
  return { rowIndex, colIndex };
};

/** The two frames, or `null` when they coincide and nothing needs shifting. */
const framesOf = (sheet: IWorksheet | null, frame: FormulaFrame | null): { active: IRange.CellCoords, anchor: IRange.CellCoords } | null => {
  const anchor = anchorOf(frame?.getRanges() ?? null);
  if (!sheet || !anchor) return null;
  const { rowIndex, colIndex } = activeCellOf(sheet);
  if (rowIndex === anchor.rowIndex && colIndex === anchor.colIndex) return null;
  return { active: { rowIndex, colIndex }, anchor };
};

/**
 * The field side of a condition's formula param.
 *
 * @remarks
 * Typed text is compiled by the editing compiler, so the condition stores it canonical whatever
 * language and separators it was typed in, and it is shown back in the editing form. While the user
 * types, the field keeps their own text for as long as the param still means the same formula —
 * re-imaging it on every keystroke would reformat it under the caret.
 *
 * Inside a {@link FormulaFrameContext}, relative references are typed and shown as they read at the
 * active cell and stored as they read at the rule's anchor. A reference that would land above or
 * left of the anchor cannot be stored, and becomes `#REF!`.
 */
export const useFormulaOption = (): FormulaOptionText => {
  const sheet = useWorksheet();
  const frame = useContext(FormulaFrameContext);
  const typed = useRef<{ stored: string, text: string } | null>(null);
  const active = sheet ? activeCellOf(sheet) : null;
  const scope = sheet?.getName() ?? null;
  const home = useMemo((): Partial<IRange.CellCoords> | undefined =>
    active && scope ? { ...active, scope } : undefined,
    [scope, active?.rowIndex, active?.colIndex]
  );
  return useMemo((): FormulaOptionText => ({
    home,
    display: (formula: ICalculation.IFormula): string => {
      const last = typed.current;
      if (last && last.stored === formula.getExpression()) return last.text;
      const frames = framesOf(sheet, frame);
      if (frames) {
        try {
          const shown = sheet!.createFormula(formula.getExpression(), frames.anchor).shift(frames.active);
          if (shown) return shown.getExpression({ target: 'display' });
        } catch {
          // not compilable here; show it as stored
        }
      }
      return formula.getExpression({ target: 'display' });
    },
    compile: (text: string): ICalculation.IFormula | string => {
      const frames = framesOf(sheet, frame);
      let formula: ICalculation.IFormula | null = null;
      try {
        formula = sheet?.createFormula(text, frames?.active, { target: 'display' }) ?? null;
        if (formula && frames) formula = formula.shift(frames.anchor);
      } catch {
        formula = null; // no engine yet — the text stands in until there is one
      }
      typed.current = formula ? { stored: formula.getExpression(), text } : null;
      return formula ?? text;
    }
  }), [sheet, frame, home]);
};
