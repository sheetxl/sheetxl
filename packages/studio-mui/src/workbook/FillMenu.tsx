import type React from 'react';
import { memo, forwardRef, useMemo } from 'react';

import clsx from 'clsx';

import { Box, Typography } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { AutoFill, ICell, type IWorkbook } from '@sheetxl/sdk';

import { useTranslator, type FloatReference } from '@sheetxl/utils-react';

import { AUTO_FILL_PRESET_LABELS, type CommandContext } from '@sheetxl/react';

import { ExhibitMenuItem, ExhibitDivider } from '@sheetxl/utils-mui';

export interface FillMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The workbook the drag happened in. */
  workbook: IWorkbook;
  /** What the drag offers and runs — see {@link CommandContext.FillMenu}. */
  menu: CommandContext.FillMenu;
  disabled?: boolean;
  floatReference: FloatReference;
}

/** One row of the menu: what it is called, when it applies, and what it runs. */
interface FillMenuEntry {
  key: string;
  /** Message key of the label. */
  label: string;
  /** Whether the entry is live for the presets the template offers. */
  enabled: (offered: ReadonlySet<string>) => boolean;
  run: (menu: CommandContext.FillMenu) => void;
}

const DIVIDER = '-';

/** An entry that runs one preset and is live exactly where the template offers it. */
const presetEntry = (id: string): FillMenuEntry => ({
  key: id,
  label: AUTO_FILL_PRESET_LABELS[id],
  enabled: (offered: ReadonlySet<string>): boolean => offered.has(id),
  run: (menu: CommandContext.FillMenu): void => { void menu.fill({ presetId: id }); }
});

/**
 * The menu, in Excel's order: the four everyday fills, the numeric series, the date series, the two
 * fits, and the dialog. Excel's `Flash Fill` sits between the fits and `Series…` and is left out
 * rather than shown greyed — it is not offered anywhere yet.
 *
 * `Copy Cells`, `Fill Formatting Only` and `Fill Without Formatting` are always live: each does for
 * a blank or unrecognized template exactly what a left-drag does (repeats it), so there is no state
 * in which greying them would say something true. The rest are live where the template offers
 * their preset, which is the enablement Excel's menu shows.
 */
const ENTRIES: readonly (FillMenuEntry | typeof DIVIDER)[] = Object.freeze([
  {
    key: 'copy',
    label: AUTO_FILL_PRESET_LABELS[AutoFill.Presets.Copy.id],
    enabled: (): boolean => true,
    run: (menu: CommandContext.FillMenu): void => { void menu.fill({ presetId: AutoFill.Presets.Copy.id }); }
  },
  presetEntry(AutoFill.Presets.Series.id),
  {
    key: 'formatsOnly',
    label: messageKey('fillMenu.formatsOnly'),
    enabled: (): boolean => true,
    run: (menu: CommandContext.FillMenu): void => { void menu.fill({ type: ICell.Content.Formats }); }
  },
  {
    key: 'valuesOnly',
    label: messageKey('fillMenu.valuesOnly'),
    enabled: (): boolean => true,
    run: (menu: CommandContext.FillMenu): void => {
      void menu.fill({ presetId: AutoFill.Presets.Series.id, type: ICell.Content.Values });
    }
  },
  DIVIDER,
  presetEntry(AutoFill.Presets.Linear.id),
  presetEntry(AutoFill.Presets.Growth.id),
  DIVIDER,
  /* Smallest unit first, as Excel lists them — the dialog lists them largest first, which is the
     order a template is DETECTED in; a menu is read top-down for the common case. */
  presetEntry(AutoFill.Presets.DateDays.id),
  presetEntry(AutoFill.Presets.DateWeekdays.id),
  presetEntry(AutoFill.Presets.DateMonths.id),
  presetEntry(AutoFill.Presets.DateMonthEnd.id),
  presetEntry(AutoFill.Presets.DateYears.id),
  DIVIDER,
  presetEntry(AutoFill.Presets.LinearTrend.id),
  presetEntry(AutoFill.Presets.GrowthTrend.id),
  DIVIDER,
  {
    key: 'seriesDialog',
    label: messageKey('fillMenu.series'),
    /* Every type in the dialog is a preset, so the dialog has something to say wherever the
       template offers anything at all. */
    enabled: (offered: ReadonlySet<string>): boolean => offered.size > 0,
    run: (menu: CommandContext.FillMenu): void => { menu.series(); }
  }
]);

/**
 * Excel's fill menu — what a right-drag of the fill handle offers on release.
 *
 * @remarks
 * Presentation only: the entries and their order live here, their labels are the shared preset
 * labels, and everything else (which apply, what an entry does) is the context's.
 */
export const FillMenu = memo(forwardRef<HTMLDivElement, FillMenuProps>((props: FillMenuProps, refForwarded) => {
  const {
    workbook: _workbook,
    menu,
    disabled: propDisabled,
    floatReference,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();

  const offered = useMemo((): ReadonlySet<string> => new Set(menu.offered), [menu]);

  /* The choice goes first: closing the float reports a cancel, which the context ignores only once
     an entry has claimed the drag. */
  const choose = (entry: FillMenuEntry): void => {
    entry.run(menu);
    void floatReference.close();
  };

  const items = ENTRIES.map((entry: FillMenuEntry | typeof DIVIDER, index: number): React.ReactNode => {
    if (entry === DIVIDER) return <ExhibitDivider key={`divider:${index}`} orientation="horizontal"/>;
    const isDisabled = propDisabled || !entry.enabled(offered);
    return (
      <ExhibitMenuItem
        key={entry.key}
        className="sxl-fillMenu-entry"
        data-entry={entry.key}
        disabled={isDisabled}
        sx={{ display: 'flex', paddingTop: '4px', paddingBottom: '4px', flex: 'none' }}
        onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); }}
        onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0 || isDisabled) return; choose(entry); }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (isDisabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(entry); }
        }}
      >
        <Box sx={{ display: 'flex', flex: '1 1 100%', flexDirection: 'column', overflow: 'hidden' }}>
          <Typography
            component="div"
            sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {t(entry.label)}
          </Typography>
        </Box>
      </ExhibitMenuItem>
    );
  });

  return (
    <Box
      ref={refForwarded}
      className={clsx('menu', 'sxl-fillMenu', propClassName)}
      sx={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px' // TODO - size of rounded border from theme
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

FillMenu.displayName = 'FillMenu';
