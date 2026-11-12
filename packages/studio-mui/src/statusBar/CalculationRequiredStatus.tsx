import type React from 'react';
import { memo, useCallback, useReducer } from 'react';

import clsx from 'clsx';

import { type Theme, Typography } from '@mui/material';

import { TimerUtils, ICalculation, type IWorksheet } from '@sheetxl/sdk';

import { useTranslator, useCommands } from '@sheetxl/utils-react';

import { useModelListener, useWorksheet, useWorkbook } from '@sheetxl/react';

export interface CalculationRequiredStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Debounce (ms) between a change and the re-read.
   *
   * @defaultValue 40
   */
  debounceDelay?: number;
}

/**
 * The status bar's `Calculate` readout — shown while the workbook is in manual calculation mode
 * and a formula is out of date (Excel's own indicator). Pressing it is Calculate Now (F9).
 *
 * @remarks
 * Renders nothing in automatic mode, and in manual mode once a recalculation has settled. Read
 * on the calculation's `onStale` (an edit that left something out of date), `onOptionsChange`
 * (the mode itself) and the selected sheet's data changes (a pass landing), debounced like the
 * number stats.
 */
export const CalculationRequiredStatus = memo((props: CalculationRequiredStatusProps) => {
  const {
    debounceDelay = 40,
    className,
    style: propStyle,
    ...rest
  } = props;

  const workbook = useWorkbook();
  const sheet: IWorksheet | null = useWorksheet();
  const calculation: ICalculation | null = workbook?.getCalculation() ?? null;
  const t = useTranslator();
  const [calculateCommand] = useCommands(['calculateAll']);

  const [, bump] = useReducer((s: number) => s + 1, 0);
  const bumpDebounced: () => void = useCallback(TimerUtils.debounce(bump, debounceDelay), [debounceDelay]);

  // `useModelListener` tolerates a null source at runtime but types it non-null; bridge here.
  useModelListener<ICalculation, ICalculation.IListeners>(calculation as ICalculation, {
    onStale: bumpDebounced,
    onOptionsChange: bumpDebounced,
    onStatusChange: bumpDebounced
  });
  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet as IWorksheet, {
    onDataChange: bumpDebounced,  // a calc pass landing
    onInvalidated: bumpDebounced  // undo
  }, {
    transactional: false
  });

  const required = !!calculation
    && calculation.getCalculationMode() === ICalculation.CalculationMode.Manual
    && calculation.isCalculationRequired();
  if (!required) return null;

  return (
    <div
      {...rest}
      className={clsx('calculation-required-status', className)}
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
        title={calculateCommand?.getDescription?.() ?? undefined}
        sx={{
          userSelect: 'none',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          color: (theme: Theme) => theme.palette.text.secondary,
          '&:hover': { textDecoration: 'underline' }
        }}
        onClick={() => { void (calculateCommand ? calculateCommand.execute() : calculation?.calculate()); }}
      >
        {t('statusBar.calculate')}
      </Typography>
    </div>
  );
});

CalculationRequiredStatus.displayName = 'CalculationRequiredStatus';
