import type React from 'react';
import { memo, forwardRef } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { Typography } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

import { PasswordField } from './PasswordField';

export namespace WorkbookProtectionPanel {
  /**
   * What the panel renders.
   *
   * @remarks
   * Booleans only — the panel never holds a password. Encryption's lives on the io handle and
   * structure's was only ever a hash, and neither can be read back, so "is there one" is the whole
   * of what a UI can honestly show. Typing happens in {@link PasswordDialog}.
   */
  export interface Value {
    /** The file is encrypted: its contents cannot be read without the password. */
    hasEncryptPassword: boolean;
    /** Lock the workbook's structure — a gate the UI honours; it does not hide the data. */
    structure: boolean;
    hasStructurePassword: boolean;
    lockStructure: boolean;
    lockWindows: boolean;
    /**
     * Whether the structure locks can be edited.
     *
     * @remarks
     * `false` on a protected workbook: the model refuses option changes until it is unprotected,
     * which is Excel's answer too.
     */
    locksEditable: boolean;
  }

  export interface Props {
    value: Value;
    /** Every callback commits — there is no Apply. */
    onEncryptPassword(password: string, current?: string): void;
    onEncryptPasswordClear(): void;
    onStructureChange(enabled: boolean): void;
    onStructurePassword(password: string, current?: string): void;
    onStructurePasswordClear(): void;
    onLocksChange(locks: { lockStructure: boolean; lockWindows: boolean }): void;
    sx?: any;
  }
}

/**
 * Edits a workbook's two, genuinely different, protections in one place.
 *
 * @remarks
 * Presentational — no model or IO access — so the layout stays testable on its own and the tab
 * around it owns every write.
 *
 * The two halves are grouped together because a user thinking "protect this workbook" means either,
 * and split visibly because they are not the same thing at all:
 * - **Encrypt** rewrites the file so its contents are unreadable without the password.
 * - **Protect structure** stores a hash the UI honours; the data stays fully readable to anything
 *   that opens the file.
 *
 * Excel separates these by *storage mechanism* (one is the container, one is XML in the package),
 * which puts them in unrelated parts of its UI and reliably misleads people into thinking
 * "Protect Workbook" encrypts. Grouping by intent and labelling by effect is the fix.
 *
 * Encryption has no switch of its own: it IS its password, so setting one encrypts and clearing it
 * decrypts. Structure keeps its switch because it can be protected without a password.
 *
 * Nothing here has an Apply button, for the same reason the Sheet tab does not: every control is
 * one unambiguous act, and a pane is not a dialog. Encryption still only reaches the FILE on the
 * next save — but the intent is recorded the moment it is given, and an Apply button never changed
 * that.
 */
export const WorkbookProtectionPanel = memo(forwardRef<HTMLDivElement, WorkbookProtectionPanel.Props>((props, refForwarded) => {
  const {
    value,
    onEncryptPassword, onEncryptPasswordClear,
    onStructureChange, onStructurePassword, onStructurePasswordClear,
    onLocksChange,
    sx: propSx
  } = props;
  const t = useTranslator();

  return (
    <Box
      ref={refForwarded}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        gap: (theme: Theme) => theme.spacing(2.5),
        ...propSx
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: (theme: Theme) => theme.spacing(1) }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.structure}
              onChange={(e) => onStructureChange(e.target.checked)}
            />
          }
          label={t('protection.structure.label')}
        />
        <Box sx={{ paddingLeft: 4, minWidth: 0 }}>
          <PasswordField
            hasPassword={value.hasStructurePassword}
            description={t('protection.structure.passwordDescription')}
            disabled={!value.structure}
            requireCurrent
            onSet={onStructurePassword}
            onClear={onStructurePasswordClear}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: (theme: Theme) => theme.spacing(2), paddingLeft: 4, minWidth: 0 }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
                disabled={!value.locksEditable}
                checked={value.lockStructure}
                onChange={(e) => onLocksChange({ lockStructure: e.target.checked, lockWindows: value.lockWindows })}
              />
            }
            label={t('protection.structure.lockStructure')}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
                disabled={!value.locksEditable}
                checked={value.lockWindows}
                onChange={(e) => onLocksChange({ lockStructure: value.lockStructure, lockWindows: e.target.checked })}
              />
            }
            label={t('protection.structure.lockWindows')}
          />
        </Box>
        <Typography variant="caption" sx={{ minWidth: 0, color: 'text.secondary' }}>
          {!value.locksEditable
            ? t('protection.structure.locksLocked')
            : t('protection.structure.note')}
        </Typography>
      </Box>

      {/* Last: encryption changes the file itself and cannot be undone without the password. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: (theme: Theme) => theme.spacing(1) }}>
        <Typography variant="body1" sx={{ minWidth: 0 }}>
          {t('protection.encrypt.label')}
        </Typography>
        <PasswordField
          hasPassword={value.hasEncryptPassword}
          description={t('protection.encrypt.passwordDescription')}
          onSet={onEncryptPassword}
          onClear={onEncryptPasswordClear}
        />
        <Typography variant="caption" sx={{ minWidth: 0, color: 'warning.main' }}>
          {t('protection.encrypt.warning')}
        </Typography>
      </Box>
    </Box>
  );
}));

export default WorkbookProtectionPanel;
