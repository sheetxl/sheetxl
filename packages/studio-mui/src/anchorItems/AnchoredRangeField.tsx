import type React from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';

import {
  type IAnchored, type ICalculation, type ICellRanges, type IRange, type ITransaction
} from '@sheetxl/sdk';

import { useNotifier, NotifierType, type IReactNotifier } from '@sheetxl/utils-react';

import { useModelSync, type FormulaInputApi } from '@sheetxl/react';

import { FormulaField } from '../form';
import { useEditorCommit } from '../itemsPanel';

/**
 * An anchored item whose ranges can be re-pointed. Conditional formats, data validations and
 * protected ranges satisfy this structurally.
 */
export interface ReanchorableItem extends IAnchored {
  setRanges(address: ICellRanges.Address, options?: ITransaction.OperationOptions): unknown;
}

export interface AnchoredRangeFieldProps {
  /**
   * The item to re-anchor. Written through on commit.
   */
  item: ReanchorableItem;
  /**
   * Field label. `null` renders none, for a host that names it itself.
   */
  label?: React.ReactNode | null;
  /**
   * Helper line below the field. `null` renders none; left undefined, the line is reserved for the
   * error message, which is the one thing a user can get wrong here.
   */
  helperText?: React.ReactNode | null;
}

/**
 * The ranges an anchored item covers, as a reference field.
 *
 * @remarks
 * Re-pointing an item is the edit users reach for most, and typing or picking an address is how
 * anyone expects to do it.
 *
 * `allowMulti` because OOXML's `sqref` is a list and an item is authored as several ranges as
 * readily as one; `allowCrossSheet: false` because every anchored item belongs to one sheet.
 *
 * Commit-on-done: the write re-anchors the item in the sheet's spatial index and lands one entry on
 * the undo stack, so it is not something to do on every keystroke. `'done'` is also what gives the
 * field its ✓/✗ pair and makes Enter the field's own commit point.
 */
export const AnchoredRangeField = memo<AnchoredRangeFieldProps>((props) => {
  const { item, label, helperText } = props;

  const notifier: IReactNotifier = useNotifier();

  // The anchor moves under this field for reasons other than this field — a row insert, an undo,
  // a draft being re-seeded — so the coords event is subscribed, not just the property one.
  useModelSync<IAnchored.IListeners>(
    item,
    ['onAnchorCoordsChange', 'onAnyChange'] as any
  );

  const ranges = item.getRanges();

  // Bare text resolves against the item's OWN sheet, not whichever tab is selected.
  const home = useMemo((): Partial<IRange.CellCoords> | undefined => {
    if (ranges.isInvalid()) return undefined;
    const coords = ranges.at(0).getCoords();
    return {
      rowIndex: coords.rowStart,
      colIndex: coords.colStart,
      scope: ranges.at(0).getWorksheet().getName()
    };
  }, [ranges]);

  const refRejected = useRef<boolean>(false);
  const handleDone = useCallback((value: ICalculation.IFormula | null): void => {
    refRejected.current = false;
    const next = value?.getReferences();
    if (!next || next.isInvalid()) return;
    try {
      item.setRanges(next);
    } catch (error: any) {
      refRejected.current = true;
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [item, notifier]);

  // In an editor, Save is a commit point too, and one the field cannot see for itself: text still
  // being typed is committed to the draft first. Text that does not parse, or that the item
  // refuses, holds the save back with its error showing.
  const refApi = useRef<FormulaInputApi>(null);
  useEditorCommit((): boolean => {
    const api = refApi.current;
    if (!api || !api.dirty) return true;
    if (api.error) return false;
    api.commit();
    return !refRejected.current;
  });

  return (
    <FormulaField
      grammar="reference"
      value={ranges}
      allowMulti
      allowCrossSheet={false}
      // An anchored item always occupies ranges; a cleared field is not something to commit.
      required
      home={home}
      // The anchor is a pinned position and reads as `$A$1:$C$20`, so a pick must land absolute
      // too — otherwise picking silently changes the form of the text.
      pickAs="absolute"
      changeOn="done"
      onDone={handleDone}
      apiRef={refApi}
      label={label}
      helperText={helperText}
      disabled={item.isProtected()}
    />
  );
});

AnchoredRangeField.displayName = 'AnchoredRangeField';
