import type React from 'react';
import { memo, useCallback, useEffect, useReducer, useState } from 'react';

import clsx from 'clsx';

import { type Theme, Typography } from '@mui/material';

import { TimerUtils, type IRange, type IWorksheet } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import {
  useModelListener, useWorksheet, findSheetCircularReference, formatCellAddress, selectCell
} from '@sheetxl/react';

export interface CircularReferenceStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Debounce (ms) between a data change and the re-read.
   *
   * @defaultValue 40
   */
  debounceDelay?: number;
}

/**
 * The status bar's circular-reference readout — `Circular References`, shown while the selected
 * sheet has any.
 *
 * @remarks
 * Renders nothing while the sheet has no cycles. Excel appends one cell (`: A1`); this does not
 * — a cycle has no first cell, and naming one reads as "the problem is A1" when B1 is just as
 * much in it. The cell it would name (the first member on the sheet, `Worksheet.
 * CircularReference`'s answer) is the readout's tooltip, and pressing it selects that cell. Read
 * off the sheet's `Feature.Circular` index, which is committed with the calculated values, so a
 * data change is the one signal to re-read on.
 */
export const CircularReferenceStatus = memo((props: CircularReferenceStatusProps) => {
  const {
    debounceDelay = 40,
    className,
    style: propStyle,
    ...rest
  } = props;

  const sheet: IWorksheet | null = useWorksheet();
  const t = useTranslator();

  const [nonce, bump] = useReducer((s: number) => s + 1, 0);
  const bumpDebounced: () => void = useCallback(TimerUtils.debounce(bump, debounceDelay), [debounceDelay]);

  const [target, setTarget] = useState<IRange.CellCoords | null>(null);
  useEffect(() => {
    setTarget(sheet ? findSheetCircularReference(sheet) : null);
  }, [nonce, sheet]);

  // `useModelListener` tolerates a null source at runtime but types it non-null; bridge here.
  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet as IWorksheet, {
    onDataChange: bumpDebounced,   // a calc pass landing, or an edit clearing the cycle
    onInvalidated: bumpDebounced   // undo
  }, {
    // A passive readout wants the settled answer, not the one mid-transaction.
    transactional: false
  });

  if (!sheet || !target) return null;
  const address = formatCellAddress(target, sheet.getName());

  return (
    <div
      {...rest}
      className={clsx('circular-reference-status', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        ...propStyle
      }}
    >
      <Typography
        component="div"
        variant="caption"
        role="button"
        title={address}
        sx={{
          userSelect: 'none',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          color: (theme: Theme) => theme.palette.text.secondary,
          '&:hover': { textDecoration: 'underline' }
        }}
        onClick={() => { void selectCell(sheet, target); }}
      >
        {t('statusBar.circularReferences')}
      </Typography>
    </div>
  );
});

CircularReferenceStatus.displayName = 'CircularReferenceStatus';
