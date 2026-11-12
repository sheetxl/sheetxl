import type React from 'react';
import { memo, forwardRef, useCallback, useReducer } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type IWorkbook } from '@sheetxl/sdk';

import { useTranslator, useNotifier, NotifierType } from '@sheetxl/utils-react';

import { useModelSync } from '@sheetxl/react';

import { WorkbookProtectionPanel } from './WorkbookProtectionPanel';

/** Reads what the panel renders straight off the model and the io handle. */
const readValue = (workbook: IWorkbook): WorkbookProtectionPanel.Value => {
  const origin = workbook.getOrigin();
  const protection = workbook.getProtection();
  const isLocked = protection.isLocked();
  // kept while unprotected; with none, Excel's defaults below
  const remembered = isLocked ? null : protection.getProperties();
  /* `isEncrypted()` is true when the file was READ encrypted or has had a password set that no save
     has applied yet — so it is the whole state, and nothing needs staging here. Encryption IS its
     password: there is no "encrypted, but no password" to represent. */
  return {
    hasEncryptPassword: origin.isEncrypted(),
    structure: isLocked,
    hasStructurePassword: protection.hasPassword(),
    /* `IProtection` properties name what stays ALLOWED, so a checkbox that names what gets LOCKED
       is their inverse. Excel's own default is structure locked, windows not. */
    lockStructure: isLocked ? !protection.isStructureAllowed() : remembered ? remembered.structure !== true : true,
    lockWindows: isLocked ? !protection.isWindowsAllowed() : remembered ? remembered.windows !== true : false,
    locksEditable: !isLocked
  };
};

/** The properties a lock carries, from the checkboxes that name their inverse. */
const propertiesOf = (locks: { lockStructure: boolean; lockWindows: boolean }) =>
  ({ structure: !locks.lockStructure, windows: !locks.lockWindows });

export interface WorkbookProtectionTabProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The workbook whose protection is edited. */
  workbook: IWorkbook;
}

/**
 * The **Workbook** tab of Manage Protection — {@link WorkbookProtectionPanel} bound to the model.
 *
 * @remarks
 * No Apply button, for the same reason the Sheet tab has none: every control is one unambiguous act,
 * and a pane is not a dialog. Encryption still only reaches the FILE on the next save — but that is
 * about when bytes are written, not about when the intent is recorded, and `origin.setPassword` has
 * always recorded it the moment it is given. An Apply button in front of that only added a step.
 *
 * The two halves commit through different objects: structure is a model change
 * (`IWorkbookProtection`, effective at once), encryption is a property of the io handle. See
 * `PROTECTION-DESIGN.md` §5g.
 */
export const WorkbookProtectionTab =
  memo(forwardRef<HTMLDivElement, WorkbookProtectionTabProps>((props, refForwarded) => {
  const { workbook, ...rest } = props;
  const t = useTranslator();
  const notifier = useNotifier();

  // A save that moves the workbook to another file changes which handle holds the encryption state.
  useModelSync<IWorkbook.IListeners>(workbook, ['onProtectionChange', 'onOriginChange']);

  const value = readValue(workbook);
  const { lockStructure, lockWindows } = value;

  const report = useCallback((error: any): void => {
    notifier.showMessage?.(error?.message ?? String(error), { type: NotifierType.Error });
  }, [notifier]);

  /**
   * Asks for the password already in force. `null` means the user cancelled — not a failure, so
   * every caller returns on it rather than raising a toast.
   */
  const promptCurrent = useCallback(async (): Promise<string | null | undefined> => {
    if (!workbook.getProtection().hasPassword()) return undefined;
    const input = await notifier.showInput({
      title: t('dialog.password.title'),
      description: t('protection.structure.passwordPrompt'),
      options: ['Ok', 'Cancel'],
      defaultOption: 'Ok',
      cancelOption: 'Cancel',
      inputType: 'password'
    });
    if (input?.option !== 'Ok') return null;
    return input.input || undefined;
  }, [workbook, notifier, t]);

  /* --- encryption: a property of the io handle, realized by the next save --- */

  // The io handle is not an event source, so a password change re-renders from here.
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  const setEncryptPassword = useCallback((password: string): void => {
    workbook.getOrigin().setPassword(password);
    forceRender();
  }, [workbook]);

  const clearEncryptPassword = useCallback((): void => {
    workbook.getOrigin().setPassword(null);
    forceRender();
  }, [workbook]);

  /* --- structure: a model change, effective immediately --- */

  const toggleStructure = useCallback(async (enabled: boolean): Promise<void> => {
    const protection = workbook.getProtection();
    try {
      if (!enabled) {
        const current = await promptCurrent();
        if (current === null) return;
        await protection.unlock(current);
        return;
      }
      await protection.lock(propertiesOf({ lockStructure, lockWindows }));
    } catch (error: any) {
      report(error);
    }
  }, [workbook, promptCurrent, lockStructure, lockWindows, report]);

  const setLocks = useCallback(async (locks: { lockStructure: boolean; lockWindows: boolean }): Promise<void> => {
    try {
      // the panel disables these while protected, when the model would refuse them
      await workbook.getProtection().setProperties(propertiesOf(locks));
    } catch (error: any) {
      report(error);
    }
  }, [workbook, report]);

  /* Setting a password on an already-protected workbook needs the unlock/relock round trip: only
     `lock()` writes a hash. The dialog collects the current password alongside the new one. */
  const setStructurePassword = useCallback(async (password: string, current?: string): Promise<void> => {
    const protection = workbook.getProtection();
    try {
      if (protection.isLocked()) await protection.unlock(current);
      await protection.lock(propertiesOf({ lockStructure, lockWindows }), password);
    } catch (error: any) {
      report(error);
    }
  }, [workbook, lockStructure, lockWindows, report]);

  const clearStructurePassword = useCallback(async (): Promise<void> => {
    const protection = workbook.getProtection();
    try {
      const current = await promptCurrent();
      if (current === null) return;
      await protection.unlock(current);
      await protection.lock(propertiesOf({ lockStructure, lockWindows }));
    } catch (error: any) {
      report(error);
    }
  }, [workbook, promptCurrent, lockStructure, lockWindows, report]);

  return (
    <Box
      ref={refForwarded}
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // See `WorksheetProtectionPanel` — the pane host is a flex ROW.
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        // See `WorksheetProtectionPanel` — with no global `border-box` reset, `width: 100%` plus
        // horizontal padding overflows, and `overflowX: hidden` clips the right padding away.
        boxSizing: 'border-box',
        gap: (theme: Theme) => theme.spacing(2),
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        paddingBottom: (theme: Theme) => theme.spacing(1.5),
        paddingLeft: (theme: Theme) => theme.spacing(2),
        paddingRight: (theme: Theme) => theme.spacing(2)
      }}
    >
      <WorkbookProtectionPanel
        value={value}
        onEncryptPassword={setEncryptPassword}
        onEncryptPasswordClear={clearEncryptPassword}
        onStructureChange={(enabled) => { void toggleStructure(enabled); }}
        onStructurePassword={(password, current) => { void setStructurePassword(password, current); }}
        onStructurePasswordClear={() => { void clearStructurePassword(); }}
        onLocksChange={(locks) => { void setLocks(locks); }}
      />
    </Box>
  );
}));

WorkbookProtectionTab.displayName = 'WorkbookProtectionTab';

export default WorkbookProtectionTab;
