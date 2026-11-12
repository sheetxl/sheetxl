import type React from 'react';
import { useState } from 'react';

import { type Theme } from '@mui/material';
import { Box, TextField, Typography } from '@mui/material';

import { type OptionInput, useTranslator } from '@sheetxl/utils-react';
import { OptionsDialog, type OptionsDialogProps } from '@sheetxl/utils-mui';

export interface PasswordDialogProps extends Omit<OptionsDialogProps, 'onOption' | 'children'> {
  /** One line above the fields saying what this password will protect. */
  description?: string;
  /**
   * Ask for the password already in force, above the new one.
   *
   * @remarks
   * For a *change*: the model verifies the current password before it will write a new hash, so
   * asking here keeps the whole edit in one dialog rather than a prompt followed by a dialog.
   */
  requireCurrent?: boolean;
  /** Called with the new password when the user confirms; not called on cancel. */
  onApply(password: string, current?: string): void | Promise<void>;
}

/**
 * Sets one password — for a sheet, an unlocked range, workbook structure, or encryption.
 *
 * @remarks
 * The **one** place a password is typed. It replaced a pair of inline fields on every panel that
 * could hold a password, which had to show a sentinel (`••••••••`) standing in for a hash nobody can
 * read back, and left every panel explaining the difference between "unchanged", "cleared" and
 * "new". A panel now shows only whether a password is set, and this dialog is the whole edit.
 *
 * The confirm field is what makes it a dialog rather than a single prompt: a password that cannot be
 * read back and cannot be recovered has to be typed twice, and Excel desktop confirms it in a second
 * dialog for the same reason.
 */
export const PasswordDialog: React.FC<PasswordDialogProps> = (props) => {
  const t = useTranslator();
  const {
    description,
    requireCurrent = false,
    onApply,
    title: propTitle,
    sx: propSx,
    ...rest
  } = props;

  const [current, setCurrent] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  // Errors only after a submit attempt — a mismatch shown while the second field is half typed is
  // noise, not a warning.
  const [submitted, setSubmitted] = useState<boolean>(false);

  const missing = password === '';
  const mismatch = confirm !== password;
  const valid = !missing && !mismatch;

  return (
    <OptionsDialog
      title={propTitle ?? (requireCurrent ? t('password.titleChange') : t('password.title'))}
      options={['Ok', 'Cancel']}
      defaultOption="Ok"
      cancelOption="Cancel"
      autoFocusSel={'.autoFocus'}
      sx={{ width: '380px', ...propSx }}
      // Cheap (fields present and matching), so it runs on the submit path only, to gate closing.
      onValidateOption={(option?: OptionInput) => {
        if (option === 'Cancel') return true;
        setSubmitted(true);
        return valid;
      }}
      onOption={(option: OptionInput, isCancel: boolean) => {
        if (isCancel || option !== 'Ok') return;
        return onApply(password, requireCurrent ? current : undefined);
      }}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: (theme: Theme) => theme.spacing(2),
          paddingTop: (theme: Theme) => theme.spacing(1)
        }}
      >
        {description ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        ) : null}
        {requireCurrent ? (
          <TextField
            type="password"
            size="small"
            label={t('password.current')}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { className: 'autoFocus', autoComplete: 'current-password', spellCheck: false }
            }}
          />
        ) : null}
        <TextField
          type="password"
          size="small"
          label={requireCurrent ? t('password.new') : t('password.label')}
          value={password}
          error={submitted && missing}
          helperText={submitted && missing ? t('password.required') : ' '}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              className: requireCurrent ? undefined : 'autoFocus',
              autoComplete: 'new-password',
              spellCheck: false
            }
          }}
        />
        <TextField
          type="password"
          size="small"
          label={t('protection.passwordConfirm')}
          value={confirm}
          error={submitted && !missing && mismatch}
          helperText={submitted && !missing && mismatch ? t('protection.passwordMismatch') : ' '}
          onChange={(e) => setConfirm(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { autoComplete: 'new-password', spellCheck: false }
          }}
        />
      </Box>
    </OptionsDialog>
  );
};

export default PasswordDialog;
