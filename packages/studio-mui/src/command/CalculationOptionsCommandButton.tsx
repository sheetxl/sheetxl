import type React from 'react';
import { memo, forwardRef, useEffect, useState } from 'react';

import { Box, ListItemIcon, TextField } from '@mui/material';

import { type IWorkbook, type ICalculation } from '@sheetxl/sdk';

import {
  useCommands, useCommandButtonEntry, CommandButtonType, DynamicIcon, useCallbackRef, useFloat,
  useTranslator
} from '@sheetxl/utils-react';

import { useWorkbook, useModelListener } from '@sheetxl/react';

import {
  CommandButton, CommandPopupButton, defaultRenderPopupPanel, ExhibitDivider, MenuItemInsets,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export interface CalculationOptionsCommandButtonProps extends CommandPopupButtonProps {
  /**
   * The workbook whose calculation is configured. Defaults to the ambient workbook context.
   */
  workbook?: IWorkbook | null;
}

interface LimitFieldProps {
  label: string;
  value: number;
  min: number;
  step: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

/**
 * One of the two iterative limits — a number field that commits on blur or Enter, not per
 * keystroke (each commit recalculates every cycle in the workbook).
 */
const LimitField = memo((props: LimitFieldProps) => {
  const { label, value, min, step, disabled, onCommit } = props;
  // The popup we are rendered in (context reaches us through its portal), so Enter can dismiss it.
  const float = useFloat();
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        // The menu around us navigates on keys; the field owns them while it is focused. Escape
        // still reaches the popup, which closes.
        if (e.key === 'Escape') return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          // Enter accepts and dismisses, as it does in Excel's dialog. The blur that the close causes
          // commits again, harmlessly — an unchanged value is a no-op here and in the model.
          commit();
          float?.closeAll();
        }
      }}
      slotProps={{
        htmlInput: { min, step },
        input: { sx: { backgroundColor: 'background.paper' } }
      }}
      sx={{ width: '10em' }}
    />
  );
});
LimitField.displayName = 'LimitField';

interface IterativeLimitsProps {
  calculation: ICalculation | null;
  disabled?: boolean;
}

/**
 * The Maximum Iterations / Maximum Change pair, as a menu row under the iterative toggle.
 *
 * @remarks
 * Reads the calculation itself rather than taking values from the popup button: a popup panel is
 * built once per open, so whatever the button captures in the panel's children stays frozen while the
 * menu is up — including the enabled state that the toggle right above these fields flips (it is a
 * quick action, so it leaves the menu open).
 */
const IterativeLimits = memo((props: IterativeLimitsProps) => {
  const { calculation, disabled: propDisabled } = props;

  const t = useTranslator();
  // Subscribes to the toggle's state, so the fields enable/disable with it.
  const [iterativeCommand] = useCommands(['calcIterativeToggle']);

  const [settings, setSettings] = useState<ICalculation.IterativeCalculation | null>(() => calculation?.getIterativeCalculation() ?? null);
  useEffect(() => { setSettings(calculation?.getIterativeCalculation() ?? null); }, [calculation]);
  // `useModelListener` tolerates a null source at runtime but types it non-null; bridge here.
  useModelListener<ICalculation, ICalculation.IListeners>(calculation as ICalculation, {
    onOptionsChange: () => { setSettings(calculation?.getIterativeCalculation() ?? null); }
  });

  const enabled: boolean = !!(iterativeCommand?.getState?.() ?? settings?.enabled);
  const disabled = propDisabled || !calculation || !enabled;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...MenuItemInsets, pt: 1.5, pb: 1 }}>
      {/* An empty icon, as an unchecked menu item has: it puts the fields in the label column. */}
      <ListItemIcon><DynamicIcon/></ListItemIcon>
      <LimitField
        label={t('calcOptions.maxIterations')}
        value={settings?.maxIteration ?? 100}
        min={1}
        step={1}
        disabled={disabled}
        onCommit={(value: number) => { calculation?.setIterativeCalculation({ maxIteration: value }); }}
      />
      <LimitField
        label={t('calcOptions.maxChange')}
        value={settings?.maxChange ?? 0.001}
        min={0}
        step={0.001}
        disabled={disabled}
        onCommit={(value: number) => { calculation?.setIterativeCalculation({ maxChange: value }); }}
      />
    </Box>
  );
});
IterativeLimits.displayName = 'IterativeLimits';

/**
 * Excel's Calculation Options as one popup: the calculation-mode radio (Automatic / Automatic
 * Except for Data Tables / Manual), Enable Iterative Calculation with its Maximum Iterations and
 * Maximum Change, and the two recalculations (Calculate Now, Calculate Full).
 *
 * @remarks
 * The mode and the toggle are workbook commands (`calcMode*`, `calcIterativeToggle` in
 * `WorkbookCommands`); the limits are not commands — they are number fields written straight to
 * `ICalculation.setIterativeCalculation`. Registered as `calculationOptions` (the Formulas tab) and
 * mounted again in the formula bar.
 */
export const CalculationOptionsCommandButton = memo(forwardRef<HTMLElement, CalculationOptionsCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: _groupKey,
    workbook: propWorkbook,
    disabled: propDisabled,
    ...rest
  } = props;

  const contextWorkbook = useWorkbook();
  const workbook = propWorkbook ?? contextWorkbook;
  const calculation: ICalculation | null = workbook?.getCalculation() ?? null;
  const entry = useCommandButtonEntry('calculationOptions');

  const renderPopupPanel = useCallbackRef((panelProps: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey: 'calculationOptions',
      disabled: propDisabled
    };
    const children = (<>
      <CommandButton {...commandButtonProps} commandKey="calcModeAutomatic"/>
      <CommandButton {...commandButtonProps} commandKey="calcModeAutomaticExceptTables"/>
      <CommandButton {...commandButtonProps} commandKey="calcModeManual"/>
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton {...commandButtonProps} commandKey="calcIterativeToggle"/>
      <IterativeLimits calculation={calculation} disabled={propDisabled}/>
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton {...commandButtonProps} commandKey="calculateAll"/>
      <CommandButton {...commandButtonProps} commandKey="calculateFull"/>
    </>);
    return defaultRenderPopupPanel({ ...panelProps, children });
  }, [propDisabled, calculation]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      icon="Calculate"
      // Head chrome comes from the registered `calculationOptions` entry (catalog-backed, language-aware).
      label={entry?.getLabel?.()}
      tooltip={entry?.getDescription?.()}
      disabled={propDisabled || !calculation}
      {...rest}
    />
  );
}));

CalculationOptionsCommandButton.displayName = 'CalculationOptionsCommandButton';
