import { memo, useRef } from 'react';

import { type ICalculation } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';
import { type FormulaInputApi } from '@sheetxl/react';

import { FormulaField, type FormulaFieldProps } from '../form';

import { useEditorCommit } from '../itemsPanel';

import { useFormulaOption } from './useFormulaOption';

export interface ExpressionOptionProps extends Omit<FormulaFieldProps, 'value' | 'onChange'> {
  /**
   * The option to edit — the formula, or its text.
   */
  option: ICalculation.IFormula | string;
  /**
   * The callback function to handle changes in the option.
   */
  onOptionChange: (option: ICalculation.IFormula | string) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Param editor for the `expression` operator — a formula rule deserves the formula editor
 * (reference picking, token coloring, error line), not a text box.
 *
 * @remarks
 * The `=` is required, as in Excel's own Formula box. Text without one is not a literal here (an
 * expression has no literal reading) and is refused rather than promoted, so the one rule holds
 * under every operator: `=` means formula, and a Formula condition is nothing but one. The param
 * carries no `=` on the wire; the field shows it and takes it.
 *
 * What is typed goes out as a formula compiled in the editing locale, so the condition stores it
 * canonical. An in-progress (momentarily invalid) formula still carries the user's keystrokes.
 * Text with no `=` reaches nothing, and holds the editor's Save back with its error showing.
 */
export const ExpressionOption = memo<ExpressionOptionProps>((props) => {
  const {
    option,
    onOptionChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const formulas = useFormulaOption();

  const refApi = useRef<FormulaInputApi>(null);

  const text = (option as ICalculation.IFormula)?.isIFormula
    ? formulas.display(option as ICalculation.IFormula)
    : ((option as string) ?? '');

  /* Save is a commit point the field cannot see for itself; text the field refuses holds it back. */
  useEditorCommit((): boolean => !refApi.current?.error);

  return (
    <FormulaField
      size="small"
      home={formulas.home}
      value={text}
      apiRef={refApi}
      onChangeText={(next: string) => {
        const trimmed = next.trim();
        if (trimmed.length === 0) {
          onOptionChange('');
          return;
        }
        // Not a formula: the field shows that, and there is nothing to store.
        if (!trimmed.startsWith('=')) return;
        const body = trimmed.substring(1);
        onOptionChange(body.trim().length > 0 ? formulas.compile(body) : '');
      }}
      placeholder={t('condition.enterFormula')}
      disabled={readOnly}
      fullWidth
      // The `=` is the field's: shown on a stored formula, required of a typed one.
      equals="required"
      // Fully compact: no label (the operator select on the row already says "Formula"), and no
      // reserved helper/error line — so the field centers against the row's select and close
      // button. An invalid formula still shows the error outline.
      label={null}
      showError={false}
      helperText={null}
      {...rest}
    />
  );
});

ExpressionOption.displayName = 'ExpressionOption';
