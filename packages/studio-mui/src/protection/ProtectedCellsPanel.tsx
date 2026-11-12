import type React from 'react';
import { memo, forwardRef, useReducer, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';

import { ICellRange, type IWorksheet, type ICellProtection } from '@sheetxl/sdk';

import { useTranslator, useNotifier, NotifierType } from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

/** `null` when the selected cells disagree. */
type SelectionFlag = boolean | null;

interface SelectionProtection {
  alwaysUnlocked: SelectionFlag;
  showFormulas: SelectionFlag;
}

const mergeFlag = (seen: SelectionFlag | undefined, value: boolean): SelectionFlag =>
  seen === undefined ? value : (seen === value ? value : null);

const cellCount = (coords: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }): number =>
  (coords.rowEnd - coords.rowStart + 1) * (coords.colEnd - coords.colStart + 1);

/** One read per protection block, never per cell, so a whole-column selection costs what a cell does. */
const readSelection = (sheet: IWorksheet): SelectionProtection => {
  let alwaysUnlocked: SelectionFlag | undefined;
  let showFormulas: SelectionFlag | undefined;
  const note = (protection: ICellProtection): void => {
    alwaysUnlocked = mergeFlag(alwaysUnlocked, protection.isAlwaysUnlocked());
    showFormulas = mergeFlag(showFormulas, protection.isShowFormulas());
  };
  for (const coords of sheet.getSelectedRanges().getCoords()) {
    let covered = 0;
    for (const region of sheet.getRange(coords).getRegions(ICellRange.Feature.Protection)) {
      covered += cellCount(region.getCoords());
      note(region.getCell().getProtection());
    }
    // Cells no region covers have no protection of their own, so they read Normal's.
    if (covered < cellCount(coords)) note(sheet.getStyles().getNormal().getProtection());
  }
  return { alwaysUnlocked: alwaysUnlocked ?? null, showFormulas: showFormulas ?? null };
};

export interface ProtectedCellsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The sheet whose selected cells are edited. */
  sheet: IWorksheet;
}

/**
 * The **Cells** tab of Manage Protection: the protection format of the selected cells.
 *
 * @remarks
 * Two checkboxes over `ICellStyle.getProtection()` — **Always unlocked** and **Show formulas** — that act
 * on the selection the way a format control does: a mixed selection reads indeterminate, and a click
 * writes every selected cell. Like everything in the pane, a control commits when it is used.
 *
 * Disabled while the sheet is locked, as Excel greys out its Protection tab: which cells are unlocked
 * is exactly what protection keeps from changing. A pause lifts that like any other protection.
 */
export const ProtectedCellsPanel =
  memo(forwardRef<HTMLDivElement, ProtectedCellsPanelProps>((props, refForwarded) => {
  const { sheet, ...rest } = props;
  const t = useTranslator();
  const notifier = useNotifier();
  const [, forceRender] = useReducer((s: number) => s + 1, 0);

  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet, {
    onSelectionChange: () => forceRender(),
    onStyleChange: () => forceRender(),
    onProtectionChange: () => forceRender()
  });

  const protection = sheet.getProtection();
  const readOnly = protection.isLocked();
  const { alwaysUnlocked, showFormulas } = readSelection(sheet);

  const write = useCallback((update: (target: ICellProtection) => void): void => {
    try {
      update(sheet.getSelectedRanges().getStyle().getProtection());
    } catch (error: any) {
      notifier.showMessage?.(error?.message ?? String(error), { type: NotifierType.Error });
    }
  }, [sheet, notifier]);

  return (
    <Box
      ref={refForwarded}
      {...rest}
      sx={{
        // The pane layout contract; see `WorksheetProtectionPanel`.
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box',
        gap: (theme: Theme) => theme.spacing(1),
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        paddingBottom: (theme: Theme) => theme.spacing(1.5),
        paddingLeft: (theme: Theme) => theme.spacing(2),
        paddingRight: (theme: Theme) => theme.spacing(2)
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('sheetProtection.cells.description')}
      </Typography>
      {readOnly ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('sheetProtection.cells.locked')}
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
              disabled={readOnly}
              checked={alwaysUnlocked === true}
              indeterminate={alwaysUnlocked === null}
              onChange={() => write((target) => target.setAlwaysUnlocked(alwaysUnlocked !== true))}
            />
          }
          label={<Typography variant="body2">{t('sheetProtection.cells.alwaysUnlocked')}</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
              disabled={readOnly}
              checked={showFormulas === true}
              indeterminate={showFormulas === null}
              onChange={() => write((target) => target.setShowFormulas(showFormulas !== true))}
            />
          }
          label={<Typography variant="body2">{t('sheetProtection.cells.showFormulas')}</Typography>}
        />
      </Box>
    </Box>
  );
}));

ProtectedCellsPanel.displayName = 'ProtectedCellsPanel';

export default ProtectedCellsPanel;
