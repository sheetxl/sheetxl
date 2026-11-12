import type React from 'react';
import {
  useMemo, useState, useReducer, memo, forwardRef, useEffect, useCallback
} from 'react';

import clsx from 'clsx';

import { Typography } from '@mui/material';

import {
  type FormulaError, IRangeStats, CommonUtils, InternalClipboard, TimerUtils, NumberFormat,
  type IWorksheet, type ICell, type ICellRanges
} from '@sheetxl/sdk';

import { useTranslator, type TranslateFn } from '@sheetxl/utils-react';
import { useModelListener, useWorksheet } from '@sheetxl/react';

import { SimpleTooltip } from '@sheetxl/utils-mui';

// import { type StatusBarItem } from './StatusBar';

import styles from './NumberStats.module.css';

export interface NumberStatsProps extends React.HTMLAttributes<HTMLDivElement>, React.Attributes {
  /**
   * An optional list of stats to display.
   */
  stats?: IRangeStats.Aggregate[];
  /**
   * Default debounce delay.
   *
   * @defaultValue 40
   */
  debounceDelay?: number;
}

// TODO - We need a way to toggle visibility
// TODO - save to preferences
// TODO - a menu with all
// TODO - returns as a StatusBar list.
export const NumberStats = memo(forwardRef<HTMLDivElement, NumberStatsProps>((props: NumberStatsProps, refForwarded) => {
  const {
    className,
    stats: propStatsKeys = _defaultStats, // or a single stat?
    debounceDelay = 40,
    style: propStyle,
    ...rest
  } = props;

  const reducer = (s: number) => {
    return s + 1;
  }

  const sheet: IWorksheet | null = useWorksheet();
  const t = useTranslator();

  const [calcedStats, setCalcedStats] = useState<StatsCalced | null>(null);
  // const [isCalcing, setIsCalcing] = useState<boolean>(false);
  const [statsRender, forceStatsRender] = useReducer(reducer, 0);
  const updateStatsDebounced:() => void = useCallback(TimerUtils.debounce(forceStatsRender, debounceDelay), [debounceDelay]);

  useEffect(() => {
    if (!sheet) return;
    const selectedRanges = sheet.getSelectedRanges();
    if (selectedRanges.isSingleCell()) {
      setCalcedStats(null);
      return;
    }
    const doGetStats = async () => {
      let firstError: FormulaError.Known | null = null;
      const selectedStats = selectedRanges.getStats({
        // Excel's status bar measures what the sheet is SHOWING — a row hidden by a table filter or
        // by hand is out of the summary either way. (`SUBTOTAL` is the one place Excel separates the
        // two causes; this is not.) A fully hidden selection reads a count of 0 and falls into the
        // `<= 1` no-summary branch below.
        ignoreHidden: true,
        onError: (onError: FormulaError.Known): void => {
          if (!firstError) {
            firstError = onError;
          }
        }
      });
      // Sum and Average report what Excel's SUM/AVERAGE would, not the raw IEEE total: a
      // cancelling selection reads `0`, never `5.55111512312578E-17`. `getSnappedSum` is a no-op
      // for every ordinary selection, and AVERAGE divides the SNAPPED sum (snapping the mean
      // instead is measurably wrong — NUMFMT-ROUNDING.md §7). Min/max/count are untouched, and
      // `getAggregates().sum` stays available wherever the true total is what's wanted.
      const aggregates: IRangeStats.Aggregates = selectedStats.getAggregates();
      const snappedSum = selectedStats.getSnappedSum();
      const stats: IRangeStats.Aggregates = snappedSum === aggregates.sum ? aggregates : {
        ...aggregates,
        sum: snappedSum,
        average: aggregates.numericalCount > 0 ? snappedSum / aggregates.numericalCount : null
      };

      // const selectedCell = selectedSheet.getSelectedCell(); // we could use this but we act like Excel
      const first = selectedRanges.at(0);
      const coords = first.getCoords();
      const cell = first.getCell({
        colIndex: coords.colStart,
        rowIndex: coords.rowStart
      }); // always top left (this is the default but we make it explicit)
      if ((stats.count ?? 0) <= 1) {
        setCalcedStats(null); // mimic excel
        return;
      }
      setCalcedStats({
        cell,
        ranges: selectedRanges,
        stats,
        firstError
      });
    }
    doGetStats();
  }, [statsRender, sheet]);

  // `useModelListener` tolerates a null source at runtime (`if (!source) return`) but its type
  // declares it non-null; bridge the nullable `sheet` here.
  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet as IWorksheet, {
    onSelectionChange: (): void => {
      // TODO - only if ranges change not cell anchor
      updateStatsDebounced();
    },
    onStyleChange: (): void => { // for formatting
      updateStatsDebounced();
    },
    onInvalidated: (): void => { // undo
      updateStatsDebounced();
    },
    onDataChange: (): void => { // any data change. Not we could use `useDataSync()` but this is ok.
      updateStatsDebounced();
    },
    // The summary reads `ignoreHidden`, so hiding a row moves it. These rather than the coarse
    // `onLayoutChange`, which a plain resize also raises — dragging a column edge would otherwise
    // rescan the whole selection for a number that cannot have moved.
    onRowsHiddenChange: (): void => {
      updateStatsDebounced();
    },
    onColumnsHiddenChange: (): void => {
      updateStatsDebounced();
    }
  }, {
    // A passive readout: it wants the settled answer, not the one mid-transaction. A transactional
    // subscription is also held in transaction state, so it would miss the undo of a hide.
    transactional: false
  });

  const statsElements = useMemo(() => {
    if (!calcedStats || !propStatsKeys) return null;
    const stats = calcedStats.stats;
    if (!stats) return null;
    if (!stats.count) return;

    let statKeys = propStatsKeys;
    let numberStatsLength = statKeys.length;
    // if there are no numbers then only show count (if requested)
    if (stats.numericalCount === 0) {
      if (statKeys.indexOf(IRangeStats.Aggregate.Count) >= 0) {
        numberStatsLength = 1;
        statKeys = [IRangeStats.Aggregate.Count];
      } else {
        return null;
      }
    } else if (calcedStats.firstError) {
      numberStatsLength = 2;
      statKeys = [IRangeStats.Aggregate.Count, IRangeStats.Aggregate.NumericalCount];
    }

    const elements = new Array(numberStatsLength);

    const cell = calcedStats.cell;
    for (let i=0; i<numberStatsLength; i++) {
      const statKey = statKeys[i];
      let options = _ReuseCreateTemporaryCellOptions;
      if (statKey === IRangeStats.Aggregate.StdDev || statKey === IRangeStats.Aggregate.Variance) {
        continue;
      }
      if (statKey === IRangeStats.Aggregate.Count || statKey === IRangeStats.Aggregate.NumericalCount) {
        options = _ReuseCreateTemporaryCellOptionsGeneral
      }
      options.value = stats[statKey];

      const asFormattedStat = cell.createCell(options);
      if (asFormattedStat.getNumberFormat().errorPlaceholder) continue; // not formatted correctly so skip.

      elements.push(
        <StatItem
          key={`stat:${statKey}`}
          cell={asFormattedStat}
          label={statLabel(t, statKey)}
          // description={statKey}
        />
      );
    }
    return elements;
  }, [calcedStats, propStatsKeys, t]);

  return (
    <div
      ref={refForwarded}
      className={clsx(className, styles['stats-items'])}
      style={propStyle}
      {...rest}
    >
      {statsElements}
    </div>
  );
}));

NumberStats.displayName = 'NumberStats';

/**
 * Localized display name for a stat. The `IRangeStats.Aggregate` values are canonical — a literal
 * `t()` pair per stat keeps the extractor seeing `key → english`; unknown stats fall back to the
 * prettified canonical key.
 */
function statLabel(t: TranslateFn, statKey: IRangeStats.Aggregate): string {
  switch (statKey) {
    case IRangeStats.Aggregate.Average: return t('numberStats.average');
    case IRangeStats.Aggregate.Count: return t('numberStats.count');
    case IRangeStats.Aggregate.NumericalCount: return t('numberStats.numericalCount');
    case IRangeStats.Aggregate.Min: return t('numberStats.min');
    case IRangeStats.Aggregate.Max: return t('numberStats.max');
    case IRangeStats.Aggregate.Sum: return t('numberStats.sum');
    default: return CommonUtils.camelToPrettyCase(statKey);
  }
}

const _defaultStats: readonly IRangeStats.Aggregate[] = Object.freeze([
  IRangeStats.Aggregate.Average,
  IRangeStats.Aggregate.Count,
  IRangeStats.Aggregate.NumericalCount,
  IRangeStats.Aggregate.Min,
  IRangeStats.Aggregate.Max,
  IRangeStats.Aggregate.Sum
]);

const _ReuseCreateTemporaryCellOptions: { value: number | null | undefined; style?: { numberFormat: string } } = {
  value: 0
}

const _ReuseCreateTemporaryCellOptionsGeneral: { value: number | null | undefined; style?: { numberFormat: string } } = {
  value: 0,
  style: {
    numberFormat: NumberFormat.Type.General
  }
}

interface StatsCalced {
  cell: ICell;
  ranges: ICellRanges;
  stats: IRangeStats.Aggregates;
  firstError: FormulaError.Known | null;
}
// TODO - as a cell for formatting?
export interface StatItemProps extends React.HTMLAttributes<HTMLDivElement>, React.Attributes {
  /**
   * Cell that contains the value of the stat
   */
  cell?: ICell;

  label?: string;
  /**
   * Used for tool
   */
  description?: string;
}

// const items:StatusBarItem[] = [
//   {
//     key: 'number-stats',
//     createElement: (props: React.HTMLAttributes<HTMLDivElement>) => <NumberStats {...props} workbook={props.workbook!} />
//   }
// ];

const StatItem = memo(forwardRef<HTMLDivElement, StatItemProps>((props: StatItemProps, refForwarded) => {
  const {
    cell,
    label,
    description,
    className: propClassName,
    style: propStyle,
    ...rest
  } = props;

  const t = useTranslator();

  return (
    <div
      ref={refForwarded}
      className={clsx(propClassName, styles['stats-item'])}
      style={propStyle}
      {...rest}
    >
      <SimpleTooltip
        disableInteractive
        placement="top"

        // `''` = literal apostrophe in the ICU subset (`'{` would quote the placeholder literally).
        title={description ?? (label
          ? t('numberStats.copyTooltip', { label })
          : t('numberStats.copyTooltipNoLabel'))}
      >
        <div
          onClick={() => {
            const value = cell?.getValue();
            if (value !== null && value !== undefined) {
              // We use the InternalClipboard
              InternalClipboard.Global.writeText(String(value));
              // navigator.clipboard.writeText(String(value));
            }
          }}
          className={clsx(styles['stats-item-label'])}
        >
          { label && <Typography
            noWrap={true}
            component="div"
            sx={{
              fontSize: '0.7rem',
            }}
          >
            {`${label}: `}
          </Typography>}
          <Typography
            noWrap={true}
            component="div"
            sx={{
              fontSize: '0.7rem'
            }}
          >
            {cell?.getText()}
          </Typography>
        </div>
      </SimpleTooltip>
    </div>
  );
}));
