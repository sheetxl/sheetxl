import type React from 'react';
import { useState, memo, forwardRef, useCallback } from 'react';

import { type Theme } from '@mui/material';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, FormControlLabel,
  Switch, Typography
} from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorksheet, type IWorksheetProtection, type IWorksheetView } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator, useNotifier, NotifierType } from '@sheetxl/utils-react';

import { useModelSync } from '@sheetxl/react';

import { PasswordField } from './PasswordField';

/** One checkbox: a model property key and the message that names it. */
interface SheetProtectionOption {
  key: keyof IWorksheetProtection.Properties;
  messageKey: string;
  /** What a lock that never set this option carries. @defaultValue false */
  defaultValue?: boolean;
}

/**
 * The options: Excel's 15, in its own dialog order, then ours.
 *
 * @remarks
 * DATA, not markup, for a reason that comes due later: a chart sheet protects only `content` +
 * `objects`, and that wants to be a FILTER over this list rather than a second panel.
 *
 * All are shown, including the two we only round-trip (`pivotTables`, `scenarios`) and the ones
 * whose enforcement is not yet proven end to end. A file that carries a setting the UI cannot show
 * is how that setting silently disappears on the next save.
 */
const OPTIONS: readonly SheetProtectionOption[] = Object.freeze([
  // Excel's own default: both select boxes on.
  { key: 'selectLockedCells', messageKey: messageKey('sheetProtection.option.selectLockedCells'), defaultValue: true },
  { key: 'selectUnlockedCells', messageKey: messageKey('sheetProtection.option.selectUnlockedCells'), defaultValue: true },
  { key: 'formatCells', messageKey: messageKey('sheetProtection.option.formatCells') },
  { key: 'formatColumns', messageKey: messageKey('sheetProtection.option.formatColumns') },
  { key: 'formatRows', messageKey: messageKey('sheetProtection.option.formatRows') },
  { key: 'insertColumns', messageKey: messageKey('sheetProtection.option.insertColumns') },
  { key: 'insertRows', messageKey: messageKey('sheetProtection.option.insertRows') },
  { key: 'insertHyperlinks', messageKey: messageKey('sheetProtection.option.insertHyperlinks') },
  { key: 'deleteColumns', messageKey: messageKey('sheetProtection.option.deleteColumns') },
  { key: 'deleteRows', messageKey: messageKey('sheetProtection.option.deleteRows') },
  { key: 'sort', messageKey: messageKey('sheetProtection.option.sort') },
  // The model key is `autoTable`; OOXML — and Excel's dialog — call it AutoFilter.
  { key: 'autoTable', messageKey: messageKey('sheetProtection.option.autoFilter') },
  { key: 'pivotTables', messageKey: messageKey('sheetProtection.option.pivotTables') },
  { key: 'objects', messageKey: messageKey('sheetProtection.option.objects') },
  { key: 'scenarios', messageKey: messageKey('sheetProtection.option.scenarios') },
  // Not in Excel's dialog, which can only hide formulas per cell. On by default, so a lock hides
  // nothing it was not asked to.
  { key: 'showFormulas', messageKey: messageKey('sheetProtection.option.showFormulas'), defaultValue: true }
] as const);

/**
 * The flags as plain booleans, so a missing key and an explicit value cannot diverge. Read the same
 * protected or not: an unprotected sheet keeps its options.
 */
const readOptions = (protection: IWorksheetProtection): Partial<IWorksheetProtection.Properties> => {
  const properties = protection.getProperties() ?? {};
  const options: Partial<IWorksheetProtection.Properties> = {};
  for (const option of OPTIONS) {
    options[option.key] = (properties[option.key] ?? option.defaultValue ?? false) === true;
  }
  return options;
};

export interface WorksheetProtectionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The sheet whose protection is edited. */
  sheet: IWorksheet;
}

/**
 * The **Sheet** tab of Manage Protection: protect / pause / highlight, the password, and the
 * options.
 *
 * @remarks
 * **Nothing here has an Apply button.** Excel has none either — its dialog has OK, which this pane
 * is not. Every control commits the moment it is used:
 * - the two switches and the pause button act immediately;
 * - the password is a dialog; confirming it stages the password for the Protect switch, since an
 *   unprotected sheet keeps no hash ({@link PasswordField});
 * - an option checkbox writes through `setProperties` — the unprotected sheet keeps its options (and
 *   saves them) for the next `lock()`.
 *
 * While the sheet is locked, neither the password nor the options can change: the model refuses, and
 * both are disabled with the instruction Excel gives — unprotect first. A pause is a temporary
 * unprotect that already asked for the password, so the options open up again; the password stays
 * disabled, since only `lock()` writes a hash.
 *
 * The options are collapsed by default; expanded they take the rest of the pane and scroll inside
 * themselves. Fifteen checkboxes are a rare edit, and letting them push the toggles off the top made
 * the common ones the hard ones.
 *
 * Three states for the sheet, not two. `isLocked()` reads false while paused — correct for
 * enforcement, wrong for chrome — so this reads `isPaused()` separately: the Protect switch stays
 * on and a banner says why nothing is being enforced.
 */
export const WorksheetProtectionPanel =
  memo(forwardRef<HTMLDivElement, WorksheetProtectionPanelProps>((props, refForwarded) => {
  const { sheet, ...rest } = props;
  const t = useTranslator();
  const notifier = useNotifier();

  const protection = sheet.getProtection();
  const view: IWorksheetView = sheet.getView();
  useModelSync<IWorksheet.IListeners>(sheet, ['onProtectionChange']);
  // The highlight is a view setting — the view is a stable instance, so it is read through its own
  // subscription.
  useModelSync<IWorksheetView.IListeners>(view, ['onAnyChange']);

  const isPaused = protection.isPaused();
  const isLocked = protection.isLocked() || isPaused;
  const hasPassword = protection.hasPassword();

  /* Only the password is staged while the sheet is UNPROTECTED: a hash is written by `lock()` and
     not kept by an unprotected sheet. The options live on the model either way. */
  const [stagedPassword, setStagedPassword] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);

  const options = readOptions(protection);
  // locked ⇒ the model refuses; unprotecting or pausing is the way through
  const optionsReadOnly = protection.isLocked();

  const report = useCallback((error: any): void => {
    notifier.showMessage?.(error?.message ?? String(error), { type: NotifierType.Error });
  }, [notifier]);

  /**
   * Asks for the CURRENT password. `null` means the user cancelled — not a failure, so every caller
   * returns on it rather than raising a toast.
   */
  const promptPassword = useCallback(async (description: string): Promise<string | null> => {
    const input = await notifier.showInput({
      title: t('dialog.password.title'),
      description,
      options: ['Ok', 'Cancel'],
      defaultOption: 'Ok',
      cancelOption: 'Cancel',
      inputType: 'password'
    });
    if (input?.option !== 'Ok') return null;
    return input.input ?? '';
  }, [notifier, t]);

  const updateOption = useCallback((key: keyof IWorksheetProtection.Properties, value: boolean): void => {
    void protection.setProperties({ ...readOptions(protection), [key]: value }).catch(report);
  }, [protection, report]);

  const toggleProtect = useCallback(async (next: boolean): Promise<void> => {
    try {
      if (!next) {
        let password: string | undefined;
        if (protection.hasPassword()) {
          const entered = await promptPassword(t('dialog.password.description'));
          if (entered === null) return;
          password = entered || undefined;
        }
        // The sheet keeps its options, so turning it back on protects the same way.
        await protection.unlock(password);
        setStagedPassword(null);
        return;
      }
      await protection.lock(undefined, stagedPassword || undefined);
      setStagedPassword(null);
    } catch (error: any) {
      report(error);
    }
  }, [protection, promptPassword, t, stagedPassword, report]);

  /* Pause is a BUTTON, not a switch: it is an act with a password behind it (when the sheet has
     one), and resume is that act's undo — not a setting the sheet carries. Everything survives it:
     the password, the options, and the session access already granted to unlocked ranges. */
  const togglePause = useCallback(async (): Promise<void> => {
    try {
      if (protection.isPaused()) {
        protection.resume();
        return;
      }
      let password: string | undefined;
      if (protection.hasPassword()) {
        const entered = await promptPassword(t('dialog.password.pauseDescription'));
        if (entered === null) return;
        password = entered || undefined;
      }
      await protection.pause(password);
    } catch (error: any) {
      report(error);
    }
  }, [protection, promptPassword, t, report]);

  // only `lock()` writes a hash, so the password is staged for the Protect switch
  const setPassword = useCallback((password: string): void => {
    setStagedPassword(password);
  }, []);

  const clearPassword = useCallback((): void => {
    setStagedPassword(null);
  }, []);

  return (
    <Box
      ref={refForwarded}
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        /* The pane host is a flex ROW, so without a declared width the panel shrink-wraps its
           widest control and leaves the rest of the frame empty. Same contract as `ItemsPanel`'s
           `.details-panel`, which is the one that demonstrably lays out in this frame. */
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        // Nothing in a settings pane should ever scroll sideways; a stray wide child wraps instead.
        overflowX: 'hidden',
        overflowY: 'auto',
        /* There is no global `border-box` reset in the app, so `width: 100%` PLUS horizontal
           padding makes this box 32px wider than the frame — and `overflowX: hidden` then clips
           that overflow away, taking the right padding with it while the left survives. */
        boxSizing: 'border-box',
        gap: (theme: Theme) => theme.spacing(2),
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        paddingBottom: (theme: Theme) => theme.spacing(1.5),
        paddingLeft: (theme: Theme) => theme.spacing(2),
        paddingRight: (theme: Theme) => theme.spacing(2)
      }}
    >
      {/* One cluster, rows back to back. A `Switch` row is already 38px of mostly padding, so a
          gap on top of it read as three unrelated settings rather than one group. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <FormControlLabel
          control={
            <Switch checked={isLocked} onChange={(e) => { void toggleProtect(e.target.checked); }} />
          }
          label={t('sheetProtection.protect')}
        />

        {/* Needs a protected sheet; paused counts, since that is the resume direction. Sized to
            the switch rows around it so the cluster keeps one rhythm. */}
        <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '38px' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={!isLocked}
            startIcon={<DynamicIcon iconKey={isPaused ? 'Lock' : 'LockOpen'} size={18} ariaHidden />}
            onClick={() => { void togglePause(); }}
            sx={{ textTransform: 'none' }}
          >
            {isPaused ? t('sheetProtection.resume') : t('sheetProtection.pause')}
          </Button>
        </Box>

        {isPaused ? (
          <Alert
            severity="warning"
            sx={{ marginTop: (theme: Theme) => theme.spacing(0.5), marginBottom: (theme: Theme) => theme.spacing(1) }}
          >
            {t('sheetProtection.pausedBanner')}
          </Alert>
        ) : null}

        {/* A view setting, so it changes nothing in the workbook — and works on an UNPROTECTED sheet,
            which is the moment unlocked ranges are being authored. */}
        <FormControlLabel
          control={
            <Switch
              checked={view.isShowLockedShading()}
              onChange={(e) => { view.setShowLockedShading(e.target.checked); }}
            />
          }
          label={t('sheetProtection.highlightLocked')}
        />
      </Box>

      <PasswordField
        label={t('sheetProtection.passwordHeading')}
        description={t('sheetProtection.passwordDescription')}
        hasPassword={isLocked ? hasPassword : stagedPassword !== null}
        note={!isLocked && stagedPassword !== null ? t('sheetProtection.passwordPending') : undefined}
        disabled={isLocked}
        onSet={setPassword}
        onClear={clearPassword}
      />

      {/* Collapsed by default and scrolling inside itself: fifteen checkboxes are a rare edit, and
          letting them push the toggles off the top made the common controls the hard ones. */}
      <Accordion
        expanded={optionsOpen}
        onChange={(_e, expanded) => setOptionsOpen(expanded)}
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'action.hover',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
          /* Collapsed it is a header. Expanded it takes whatever the pane has left and scrolls
             inside itself — a fixed height is wrong in both directions, since how much room there
             is depends on the pane, and how much is wanted is always all fifteen. Stretching means
             pushing `flex` down MUI's Collapse chain, which is otherwise height-driven. */
          ...(optionsOpen ? {
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            '& .MuiCollapse-root': { flex: '1 1 auto', minHeight: 0, display: 'flex' },
            '& .MuiCollapse-wrapper': { flex: '1 1 auto', minHeight: 0, display: 'flex' },
            '& .MuiCollapse-wrapperInner': { flex: '1 1 auto', minHeight: 0, display: 'flex' },
            '& .MuiAccordion-region': { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' },
            '& .MuiAccordionDetails-root': { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }
          } : { flex: '0 0 auto' })
        }}
      >
        <AccordionSummary
          expandIcon={<DynamicIcon iconKey="ExpandMore" />}
          sx={{
            px: 2,
            '& .MuiAccordionSummary-content': { my: 0 },
            '&.Mui-expanded .MuiAccordionSummary-content': { my: 0 }
          }}
        >
          <Typography variant="subtitle2" sx={{ alignSelf: 'center' }}>
            {t('sheetProtection.optionsHeading')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2, display: 'flex', flexDirection: 'column' }}>
          {optionsReadOnly ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', pb: 1 }}>
              {t('sheetProtection.optionsLocked')}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {OPTIONS.map((option: SheetProtectionOption) => (
              <FormControlLabel
                key={option.key}
                control={
                  <Checkbox
                    size="small"
                    /* Vertical only — the 9px sides are what `FormControlLabel`'s -11px pull is
                       measured against, so trimming them would break the glyph column. */
                    sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
                    disabled={optionsReadOnly}
                    checked={options[option.key] === true}
                    onChange={(e) => updateOption(option.key, e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t(option.messageKey)}</Typography>}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}));

WorksheetProtectionPanel.displayName = 'WorksheetProtectionPanel';

export default WorksheetProtectionPanel;
