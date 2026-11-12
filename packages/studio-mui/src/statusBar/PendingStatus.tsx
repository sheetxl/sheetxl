import type React from 'react';
import { memo, useCallback, useReducer } from 'react';

import clsx from 'clsx';

import { TimerUtils, type ICalculation } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import { useModelListener, useWorkbook } from '@sheetxl/react';

export interface PendingStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Debounce (ms) between a change and the re-read.
   *
   * @defaultValue 40
   */
  debounceDelay?: number;
}

/**
 * The status bar's async icon: shown while function results are awaited, saying how many in its
 * tooltip. Pressing it cancels them (Excel's *Cancel Refresh*).
 *
 * @remarks
 * Renders nothing when nothing is pending. Read on the calculation's
 * `onPendingChange` and `onStatusChange`, debounced like the number stats.
 */
export const PendingStatus = memo((props: PendingStatusProps) => {
  const {
    debounceDelay = 40,
    className,
    style: propStyle,
    ...rest
  } = props;

  const workbook = useWorkbook();
  const calculation: ICalculation | null = workbook?.getCalculation() ?? null;
  const t = useTranslator();

  const [, bump] = useReducer((s: number) => s + 1, 0);
  const bumpDebounced: () => void = useCallback(TimerUtils.debounce(bump, debounceDelay), [debounceDelay]);

  // `useModelListener` tolerates a null source at runtime but types it non-null; bridge here.
  useModelListener<ICalculation, ICalculation.IListeners>(calculation as ICalculation, {
    onPendingChange: bumpDebounced,
    onStatusChange: bumpDebounced
  });

  const pending = calculation?.getPendingCount() ?? 0;
  if (pending === 0) return null;

  const cancel = (): void => { void calculation?.cancelAsync(); };
  return (
    <div
      {...rest}
      className={clsx('pending-status', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        ...propStyle
      }}
    >
      {pending > 0 && (
        <ExhibitIconButton
          aria-label="pending-results"
          icon={<DynamicIcon iconKey="PendingResults" />}
          propsTooltip={{ label: t('statusBar.pending', { count: pending }), simple: true }}
          onClick={cancel}
        />
      )}
    </div>
  );
});

PendingStatus.displayName = 'PendingStatus';
