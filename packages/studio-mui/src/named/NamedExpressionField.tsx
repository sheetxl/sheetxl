import type React from 'react';
import { memo, useCallback } from 'react';

import { type ICalculation, type INamed } from '@sheetxl/sdk';

import { useNotifier, useTranslator, NotifierType, type IReactNotifier } from '@sheetxl/utils-react';

import { useModelSync, useWorkbook, type ReferenceDoneArgs } from '@sheetxl/react';

import { FormulaField } from '../form';

import { expressionOf, isEditableNamed } from './NamedDraft';

export interface NamedExpressionFieldProps {
  /**
   * The name to redefine. Written through on commit.
   */
  named: INamed;
  /**
   * Field label. Defaults to "Refers To"; `null` renders none, for a host that names it itself.
   */
  label?: React.ReactNode | null;
  /**
   * Helper line below the field. Defaults to `null` (none) — a reserved line is left for the error
   * message, which is the one thing a user can get wrong here.
   */
  helperText?: React.ReactNode | null;
}

/**
 * A name's "Refers to" — its expression, as a formula field that writes back to the name.
 *
 * @remarks
 * The card's counterpart to a conditional format's "Apply to": re-pointing a name is the edit
 * users reach for most, and it needs none of the editor. The FORMULA grammar, not `'reference'`,
 * for the reason the editor gives — a name refers to any expression, of which a range is only the
 * common case — and unanchored, so references stay sheet-qualified.
 *
 * Commit-on-done: a redefinition lands one entry on the undo stack and re-resolves every formula
 * that reads the name, so it is not something to do on every keystroke. A derived name (a table's)
 * shows its range but takes no edit; renaming or resizing a table belongs to the table.
 */
export const NamedExpressionField = memo<NamedExpressionFieldProps>((props) => {
  const { named, label, helperText } = props;

  const t = useTranslator();
  const notifier: IReactNotifier = useNotifier();
  const workbook = useWorkbook();

  // The expression moves under this field for reasons other than this field — an undo, a sheet
  // rename, a row insert shifting the range — so the ranges event is subscribed, not just the
  // property one.
  useModelSync<INamed.IListeners>(named, ['onAnyChange', 'onRangesChange'] as any);

  const editable = isEditableNamed(named)
    && !named.isReadOnly()
    && (workbook?.getProtection().isStructureAllowed() ?? true);

  const handleDone = useCallback((value: ICalculation.IFormula | null, args: ReferenceDoneArgs): void => {
    if (args.reason !== 'accept') return;
    const next = value?.getExpression()?.trim();
    if (!next || next === expressionOf(named)) return;
    try {
      (named as ICalculation.INamedFormula).setExpression(next);
    } catch (error: any) {
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [named, notifier]);

  return (
    <FormulaField
      value={expressionOf(named)}
      // The `=` is part of the contract: what a name refers to is a FORMULA, so the field shows one.
      equals="required"
      // A name denotes a FIXED region, so a pick lands absolute — Excel's default here.
      pickAs="absolute"
      changeOn="done"
      onDone={handleDone}
      label={label === undefined ? t('named.refersTo') : label}
      helperText={helperText}
      disabled={!editable}
    />
  );
});

NamedExpressionField.displayName = 'NamedExpressionField';
