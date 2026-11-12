import type React from 'react';
import { memo, useEffect, useState } from 'react';

import { Box, Button, Chip, IconButton, Typography } from '@mui/material';

import { ICellRange, type ICell, type ICellRegion, type IRange, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import {
  addRangeAnnotations, clearRangeAnnotations, useModelListener, type TaskPaneProps
} from '@sheetxl/react';

import { ANOMALIES_SOURCE } from './_source';
import { AnomaliesMessages as M, ANOMALY_CHECK_LABELS } from './AnomaliesMessages';

type Translate = ReturnType<typeof useTranslator>;

/** One region of the `anomalies` partition, as the pane lists it. */
interface Finding {
  key: string;
  coords: IRange.Coords;
  /** The region's address, unqualified. */
  address: string;
  rows: number;
  cols: number;
  anomalies: readonly ICell.Anomaly[];
}

/** A sheet-qualified address, which the annotation store resolves against the workbook. */
const qualify = (sheet: IWorksheet, address: string): string =>
  `'${sheet.getName().replace(/'/g, "''")}'!${address}`;

/** The regions of the sheet's `anomalies` partition, highest rank first. */
const analyze = (sheet: IWorksheet): Finding[] => {
  const used = sheet.getUsedRange();
  if (!used) return [];
  return [...used.getRegions(ICellRange.Feature.Anomalies)].map((region: ICellRegion): Finding => {
    const coords = region.getCoords();
    return {
      key: `${coords.rowStart},${coords.colStart},${coords.rowEnd},${coords.colEnd}`,
      coords,
      address: region.getAddress(),
      rows: region.getRowCount(),
      cols: region.getColumnCount(),
      anomalies: region.getCell().getAnomalies()
    };
  });
};

/** The facts of one finding, as one line. Positions are R1C1, relative to the region's first cell. */
const describe = (anomaly: ICell.Anomaly, t: Translate): string => {
  const e = anomaly.evidence;
  const parts: string[] = [];
  if (e.axis !== undefined) parts.push(e.axis === 'row' ? t(M.runAlongRow) : t(M.runAlongColumn));
  if (e.expected !== undefined) parts.push(t(M.expected, { value: e.expected }));
  if (e.actual !== undefined) parts.push(t(M.actual, { value: e.actual }));
  if (e.reference !== undefined) parts.push(t(M.reference, { value: e.reference }));
  if (e.omitted !== undefined) parts.push(t(M.omitted, { value: e.omitted }));
  if (Number(e.thickness) > 1) parts.push(t(M.thickness, { count: e.thickness }));
  if (Number(e.flanks) === 1) parts.push(t(M.oneEachSide));
  return parts.join(' · ');
};

/** The check's name. */
const checkLabel = (check: ICell.ErrorCheck, t: Translate): string => {
  const key: string | undefined = ANOMALY_CHECK_LABELS[check];
  return key ? t(key) : check;
};

export interface AnomaliesTaskPaneProps extends TaskPaneProps<IWorkbook> {}

/**
 * **Anomalies** — where the selected sheet breaks its own patterns, as the `anomalies` feature
 * reports them, one card per region, highest rank first.
 *
 * @remarks
 * A snapshot: the list is what **Analyze** found and does not follow edits until it is pressed
 * again. Hovering a card outlines its region on the grid, clicking it selects the region, and
 * dismissing it takes it off the list (nothing is written to the sheet).
 */
export const AnomaliesTaskPane = memo((props: AnomaliesTaskPaneProps) => {
  const {
    model: workbook,
    args: _args,
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const t = useTranslator();
  const [sheet, setSheet] = useState<IWorksheet | null>(() => workbook?.getSelectedWorksheet() ?? null);
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange(): void {
      setSheet(workbook?.getSelectedWorksheet() ?? null);
    }
  });

  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [elapsed, setElapsed] = useState<number>(0);

  // A list is about the sheet it was taken on.
  const [listedSheet, setListedSheet] = useState<IWorksheet | null>(sheet);
  if (listedSheet !== sheet) {
    setListedSheet(sheet);
    setFindings(null);
    setDismissed(new Set());
  }

  const unhighlight = (): void => {
    if (workbook) clearRangeAnnotations(workbook, { intent: 'working', source: ANOMALIES_SOURCE });
  };
  // The outline goes with the pane.
  useEffect(() => unhighlight, [workbook]);

  if (!workbook || !sheet) return null;

  const runAnalyze = (): void => {
    unhighlight();
    const started = performance.now();
    setFindings(analyze(sheet));
    setElapsed(Math.round(performance.now() - started));
    setDismissed(new Set());
  };

  const highlight = (finding: Finding): void => {
    addRangeAnnotations(workbook, 'working', [{ range: qualify(sheet, finding.address) }], { source: ANOMALIES_SOURCE });
  };

  const listed = findings?.filter((finding: Finding) => !dismissed.has(finding.key)) ?? [];
  const cells = listed.reduce((sum: number, finding: Finding) => sum + finding.rows * finding.cols, 0);

  return (
    <Box
      ref={ref as React.Ref<HTMLDivElement>}
      {...rest}
      className="sxl-anomalies-pane"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // The pane host is a flex ROW, so a pane with no width shrink-wraps its widest control.
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        height: '100%',
        minHeight: 0,
        overflowX: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Button variant="contained" size="small" sx={{ textTransform: 'none' }} onClick={runAnalyze}>
          {t(M.analyze)}
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {findings === null
            ? sheet.getName()
            : t(M.summary, { sheet: sheet.getName(), regions: listed.length, cells, elapsed })}
        </Typography>
      </Box>

      <Box
        className="sxl-anomalies-list"
        sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1.5 }}
        onMouseLeave={unhighlight}
      >
        {findings === null ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(M.intro)}
          </Typography>
        ) : listed.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(M.none)}
          </Typography>
        ) : null}
        {listed.map((finding: Finding) => (
          <Box
            key={finding.key}
            className="sxl-anomalies-card"
            onMouseEnter={() => highlight(finding)}
            onClick={() => { void sheet.getRange(finding.coords).select(); }}
            sx={{
              display: 'flex', flexDirection: 'column', gap: 0.5, flex: '0 0 auto',
              border: 1, borderColor: 'divider', borderRadius: 1, px: 1.25, py: 1, cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{finding.address}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t(M.region, { rows: finding.rows, cols: finding.cols, rank: finding.anomalies[0]?.rank ?? 0 })}
              </Typography>
              <Box sx={{ flex: '1 1 auto' }} />
              <SimpleTooltip disableInteractive title={t(M.dismiss)}>
                <IconButton
                  size="small"
                  aria-label={t(M.dismiss)}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    unhighlight();
                    setDismissed((prev: ReadonlySet<string>) => new Set(prev).add(finding.key));
                  }}
                >
                  <DynamicIcon iconKey="Close" />
                </IconButton>
              </SimpleTooltip>
            </Box>
            {finding.anomalies.map((anomaly: ICell.Anomaly, i: number) => {
              const corroborated = anomaly.evidence.corroborated;
              const layer = anomaly.evidence.layer;
              const label = checkLabel(anomaly.check, t);
              return (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography variant="body2">
                    {layer ? t(M.checkInLayer, { check: label, layer }) : label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {describe(anomaly, t)}
                  </Typography>
                  {Array.isArray(corroborated) && corroborated.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {corroborated.map((name: string) => (
                        <Chip key={name} size="small" variant="outlined" label={name} />
                      ))}
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
});

AnomaliesTaskPane.displayName = 'AnomaliesTaskPane';

export default AnomaliesTaskPane;
