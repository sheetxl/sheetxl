import { Fragment, useMemo, memo } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { ScalarType, type IRangeStats } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

export interface WorkbookStatisticsDialogProps extends InputDialogProps<void, CommandContext.WorkbookStatistics> {};

const DEFAULT_OPTIONS = ['Ok'];

/** The type breakdown every section shows (blanks are omitted — 'cells with data' already frames it). */
const PROFILE_TYPES = [ScalarType.Number, ScalarType.String, ScalarType.Boolean, ScalarType.Error] as const;

// `labelKey`/`titleKey` are resolved with `t(key)` at render, from a variable — invisible to
// `scripts/i18n-extract.mjs`. Every key below is declared with `messageKey('…')` so extraction sees
// it; a bare literal would let the next extraction drop its English as unused.
interface StatRow { labelKey: string; value: string }

/**
 * Display-only profile of the workbook — Excel's Workbook Statistics dialog. Two sections
 * (current sheet / workbook) of count rows over `IWorksheet.getStats` / `IWorkbook.getStats`.
 *
 * TODO - also surface in the status bar.
 */
export const WorkbookStatisticsDialog = memo<WorkbookStatisticsDialogProps>((props: WorkbookStatisticsDialogProps) => {
  const {
    context,
    onDone,
    options = DEFAULT_OPTIONS,
    defaultOption = options?.[0],
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  const sections = useMemo(() => {
    const workbook = context?.().getWorkbook();
    if (!workbook) return null;
    const asRows = (stats: IRangeStats): StatRow[] => {
      const typed = stats.getTypedCounts(PROFILE_TYPES);
      return [
        { labelKey: messageKey('workbookStatistics.cellsWithData'), value: stats.getCount().toLocaleString() },
        { labelKey: messageKey('workbookStatistics.numbers'), value: (typed[ScalarType.Number] ?? 0).toLocaleString() },
        { labelKey: messageKey('workbookStatistics.text'), value: (typed[ScalarType.String] ?? 0).toLocaleString() },
        { labelKey: messageKey('workbookStatistics.booleans'), value: (typed[ScalarType.Boolean] ?? 0).toLocaleString() },
        { labelKey: messageKey('workbookStatistics.errors'), value: (typed[ScalarType.Error] ?? 0).toLocaleString() }
      ];
    };
    // `onError: 'ignore'` — an error value somewhere is population to count, not a fault
    // (the IWorkbook.getStats guidance).
    const workbookSection = {
      titleKey: messageKey('workbookStatistics.workbook'),
      subTitle: null as string | null,
      rows: [
        { labelKey: messageKey('workbookStatistics.sheets'), value: workbook.getWorksheets().getCount().toLocaleString() },
        ...asRows(workbook.getStats({ onError: 'ignore' }))
      ]
    };
    // A sheet of another kind has no cells to count; only the workbook is reported then.
    const sheet = workbook.getSelectedWorksheet();
    if (!sheet) return [workbookSection];
    const usedCoords = sheet.getUsedRange()?.getCoords();
    const endOfSheet = usedCoords
      ? sheet.getRange({ rowStart: usedCoords.rowEnd, colStart: usedCoords.colEnd, rowEnd: usedCoords.rowEnd, colEnd: usedCoords.colEnd }).getAddress()
      : '–';
    return [{
      titleKey: messageKey('workbookStatistics.currentSheet'),
      subTitle: sheet.getName() as string | null,
      rows: [
        { labelKey: messageKey('workbookStatistics.endOfSheet'), value: endOfSheet },
        ...asRows(sheet.getStats({ onError: 'ignore' }))
      ]
    }, workbookSection];
  }, [context]);

  return (
    <OptionsDialog
      title={t('workbookStatistics.title')}
      options={options}
      defaultOption={defaultOption}
      onDone={onDone}
      sx={{
        width: '340px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          rowGap: (theme: Theme) => theme.spacing(2),
          paddingBottom: (theme: Theme) => theme.spacing(1)
        }}
      >
        {sections?.map((section) => (
          <Box key={section.titleKey}>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: (theme: Theme) => theme.spacing(0.75),
                borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
                paddingBottom: (theme: Theme) => theme.spacing(0.5),
                marginBottom: (theme: Theme) => theme.spacing(0.5)
              }}
            >
              {t(section.titleKey)}
              {section.subTitle ? (
                <Typography variant="caption" component="span" color="text.secondary">
                  {section.subTitle}
                </Typography>
              ) : null}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                columnGap: (theme: Theme) => theme.spacing(2),
                rowGap: (theme: Theme) => theme.spacing(0.25)
              }}
            >
              {section.rows.map((row: StatRow) => (
                <Fragment key={row.labelKey}>
                  <Typography variant="body2" component="div" color="text.secondary">
                    {t(row.labelKey)}
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {row.value}
                  </Typography>
                </Fragment>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </OptionsDialog>
  );
});

WorkbookStatisticsDialog.displayName = "WorkbookStatisticsDialog";

export default WorkbookStatisticsDialog;
