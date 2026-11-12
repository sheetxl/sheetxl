import { memo, useRef, useState } from 'react';

import { FormulaError, ScalarType, type IWorksheet, type Scalar, type ICalculation } from '@sheetxl/sdk';

import { messageKey } from '@sheetxl/utils';
import { useTranslator } from '@sheetxl/utils-react';
import { useWorksheet, type FormulaInputApi } from '@sheetxl/react';

import { FormulaField, type FormulaFieldProps } from '../form';

import { useEditorCommit } from '../itemsPanel';

import { useFormulaOption, type FormulaOptionText } from './useFormulaOption';

/**
 * What a typed literal is, for an operand that is a date or a time.
 */
export type ScalarOptionLiteral = 'date' | 'time' | 'dateTime';

export interface ScalarOptionProps extends Omit<FormulaFieldProps, 'value' | 'onChange'> {
  /**
   * The option to edit — a literal (number, text, boolean), or a formula.
   */
  option: Scalar | ICalculation.IFormula;
  /**
   * The callback function to handle changes in the option.
   */
  onOptionChange: (option: Scalar | ICalculation.IFormula) => void;
  /**
   * How a typed literal is read. Omitted, numeric text is a number and anything else is text.
   *
   * @remarks
   * A date or time literal is typed as it is into a cell (`9/23/95`, `14:30`), held as its serial,
   * and shown back as a date or time. Text that is neither is held as typed and outlined as an
   * error, which also holds back the editor's Save.
   */
  literal?: ScalarOptionLiteral;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/** `text` as a cell entry would read it, when that is a number (a date and a time are). */
const toSerial = (sheet: IWorksheet | null, text: string): number | null => {
  if (!sheet) return null;
  const cell = sheet.createCell({ value: text }, undefined, { textParser: true });
  return cell.getType() === ScalarType.Number ? cell.getValue() as number : null;
};

/** A serial as the date or time it is. */
const fromSerial = (sheet: IWorksheet | null, serial: number, literal: ScalarOptionLiteral): string => {
  if (!sheet || serial < 0) return String(serial);
  const hasDate = serial >= 1;
  const hasTime = !Number.isInteger(serial);
  let numberFormat: string;
  if (literal === 'time' && !hasDate) {
    numberFormat = 'Long Time';
  } else if (hasTime) {
    numberFormat = hasDate ? 'Short DateTime' : 'Long Time';
  } else {
    numberFormat = 'Short Date';
  }
  return sheet.createCell({ value: serial, style: { numberFormat } }).getText();
};

/** Whether `option` is a literal that `literal` cannot hold: text where a date or time belongs. */
const isInvalidLiteral = (option: Scalar | ICalculation.IFormula, literal: ScalarOptionLiteral | undefined): boolean => {
  return !!literal && typeof option === 'string' && !option.startsWith('=');
};

/** The option as the field's text — a formula carries its `=` marker. */
const toText = (
  option: Scalar | ICalculation.IFormula,
  formulas: FormulaOptionText,
  sheet: IWorksheet | null,
  literal: ScalarOptionLiteral | undefined
): string => {
  if (option === undefined || option === null) return '';
  if ((option as ICalculation.IFormula).isIFormula) return '=' + formulas.display(option as ICalculation.IFormula);
  if (typeof option === 'boolean') return option ? 'TRUE' : 'FALSE';
  if (FormulaError.isError(option)) return option.getLabel();
  if (literal && typeof option === 'number') return fromSerial(sheet, option, literal);
  return String(option);
};

/** The field's text as the option: `=` makes a formula, numeric text is a number, anything else stays text. */
const toOption = (
  text: string,
  formulas: FormulaOptionText,
  sheet: IWorksheet | null,
  literal: ScalarOptionLiteral | undefined
): Scalar | ICalculation.IFormula => {
  if (text.length === 0) return null;
  if (text.startsWith('=')) {
    const compiled = formulas.compile(text.substring(1));
    return typeof compiled === 'string' ? text : compiled;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  if (literal) return toSerial(sheet, trimmed) ?? text;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;
  return text;
};

/**
 * The text as the option it makes — or `undefined` while it makes none: a formula that does not
 * parse (the field shows that error itself), or a literal the operand's type cannot hold.
 */
const readText = (
  text: string,
  formulas: FormulaOptionText,
  sheet: IWorksheet | null,
  literal: ScalarOptionLiteral | undefined
): Scalar | ICalculation.IFormula | undefined => {
  const option = toOption(text, formulas, sheet, literal);
  if ((option as ICalculation.IFormula)?.isIFormula && !(option as ICalculation.IFormula).isValid()) return undefined;
  if (isInvalidLiteral(option, literal)) return undefined;
  return option;
};

/**
 * Param editor for the comparison operators' Scalar param — Excel's own operand box: ONE field
 * that takes a literal or a formula, the leading `=` deciding which. Not a toggle — the `=` is
 * the convention's single discriminator (CONDITIONS-OPERANDS design §2), and a second control
 * restating it would let the two disagree.
 *
 * @remarks
 * An imported operand like `=$A$1` arrives as a formula param; a number input rendered it blank
 * and destroyed it on the first keystroke. Here it reads back as a formula, with the formula
 * editor's reference picking and token coloring once the `=` is typed.
 *
 * The operand is LIVE: each text that makes a valid operand reaches the condition as it is typed,
 * and the field keeps the text as typed until the edit ends (`9` is not re-imaged as a date under
 * the caret). Text that makes no operand is held back — a formula that does not parse, or `9/` on
 * its way to a date. A literal the operand's type cannot hold is outlined once the edit ends
 * (Enter, Tab, a blur, the editor's Save), and holds the save back.
 */
export const ScalarOption = memo<ScalarOptionProps>((props) => {
  const {
    option,
    onOptionChange,
    literal,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const sheet = useWorksheet();
  const formulas = useFormulaOption();

  const refApi = useRef<FormulaInputApi>(null);
  // The text of the edit in progress — `null` once it ends with the operand it made.
  const refText = useRef<string | null>(null);
  // A finished edit whose literal the operand cannot hold — outlined until the next keystroke.
  const [isRefused, setRefused] = useState<boolean>(false);

  /** Whether the text being edited makes an operand; `true` when nothing is being edited. */
  const isEditValid = (): boolean => {
    return refText.current === null || readText(refText.current, formulas, sheet, literal) !== undefined;
  };

  const handleText = (text: string): void => {
    setRefused(false);
    refText.current = text;
    const next = readText(text, formulas, sheet, literal);
    if (next !== undefined) onOptionChange(next);
  };

  /* Save is a commit point the field cannot see for itself (a button takes focus without a done
     key or a blur to another field), so it ends the edit — which also writes a formula's
     AutoCorrect repair. Text that does not parse, or a literal the operand's type cannot hold,
     holds the save back with its error showing. */
  useEditorCommit((): boolean => {
    const api = refApi.current;
    if (api?.error) return false;
    if (refText.current !== null) api?.commit();
    if (!isEditValid()) {
      setRefused(true);
      return false;
    }
    return !isInvalidLiteral(option, literal);
  });

  return (
    <FormulaField
      size="small"
      home={formulas.home}
      value={toText(option, formulas, sheet, literal)}
      apiRef={refApi}
      // The text channel, not the formula one: a literal is not on the formula channel (the `=` is
      // what puts text there).
      onChangeText={handleText}
      onDone={() => {
        // A cancel has already sent the text it reverted to.
        if (isEditValid()) refText.current = null;
        else setRefused(true);
      }}
      validationError={(isRefused || isInvalidLiteral(option, literal)) ? messageKey('condition.invalidDateTime') : null}
      placeholder={t('condition.enterValueOrFormula')}
      disabled={readOnly}
      fullWidth
      // The `=` decides literal vs formula; the field neither adds nor strips it.
      equals="literal"
      // A rule's operand is authored once for the whole range, so a relative reference does not
      // mean what pointing at a cell looks like it means (ScaleStopRow's reason).
      pickAs="absolute"
      // Fully compact: the operator select on the row already names the comparison, and no
      // reserved helper/error line — an invalid formula still shows the error outline.
      label={null}
      showError={false}
      helperText={null}
      {...rest}
    />
  );
});

ScalarOption.displayName = 'ScalarOption';
