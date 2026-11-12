import type React from 'react';
import { memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box, Button, Typography } from '@mui/material';

import { DynamicIcon, useNotifier, useTranslator } from '@sheetxl/utils-react';

export interface PasswordFieldProps {
  /** Whether a password is in force (or staged to be). */
  hasPassword: boolean;
  /** Heading above the row. Omit for a row that sits under someone else's heading. */
  label?: string;
  /** One line inside the dialog saying what this password will protect. */
  description?: string;
  /** Shown in place of the "a password is set" line — e.g. "will be set when you protect". */
  note?: string;
  disabled?: boolean;
  /**
   * Ask for the password already in force alongside the new one.
   *
   * @remarks
   * True where the model verifies before it will write a new hash — a protected sheet, a protected
   * workbook. False where the password is only staged and nothing has been committed yet.
   */
  requireCurrent?: boolean;
  onSet(password: string, current?: string): void | Promise<void>;
  onClear(): void | Promise<void>;
}

/**
 * The password **row**: whether one is set, and the two things you can do about it.
 *
 * @remarks
 * Deliberately not a text field. A password we hold as a hash cannot be read back, so an input
 * showing it can only show a sentinel — and then every panel has to explain what an untouched
 * sentinel, an emptied field and a typed value each mean. Set and Clear are the two acts; the
 * typing happens in {@link PasswordDialog}, which is shared by the sheet, unlocked ranges, workbook
 * structure and encryption.
 */
export const PasswordField = memo<PasswordFieldProps>((props) => {
  const {
    hasPassword, label, description, note, disabled = false, requireCurrent = false, onSet, onClear
  } = props;
  const t = useTranslator();
  const notifier = useNotifier();

  const open = useCallback((): void => {
    void notifier.showWindow('password', {
      description,
      requireCurrent: requireCurrent && hasPassword,
      onApply: onSet
    } as any);
  }, [notifier, description, requireCurrent, hasPassword, onSet]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: (theme: Theme) => theme.spacing(0.5) }}>
      {label ? <Typography variant="subtitle2">{label}</Typography> : null}
      {/* A grid, not a flex row with `margin-left: auto`: the status column is `minmax(0, 1fr)` so
          its text wraps rather than setting the pane's width, while the buttons keep theirs. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          columnGap: (theme: Theme) => theme.spacing(1)
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: (theme: Theme) => theme.spacing(0.75), minWidth: 0 }}>
          <DynamicIcon iconKey={hasPassword ? 'Lock' : 'LockOpen'} size={18} ariaHidden />
          <Typography variant="body2" sx={{ minWidth: 0, color: 'text.secondary' }}>
            {note ?? (hasPassword ? t('password.stateSet') : t('password.stateNone'))}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: (theme: Theme) => theme.spacing(1) }}>
          <Button size="small" disabled={disabled} onClick={open} sx={{ textTransform: 'none' }}>
            {hasPassword ? t('password.change') : t('password.set')}
          </Button>
          <Button
            size="small"
            color="inherit"
            disabled={disabled || !hasPassword}
            onClick={() => { void onClear(); }}
            sx={{ textTransform: 'none' }}
          >
            {t('password.clear')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

PasswordField.displayName = 'PasswordField';

export default PasswordField;
