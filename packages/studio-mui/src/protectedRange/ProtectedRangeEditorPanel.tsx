import type React from 'react';
import { memo, useState } from 'react';

import {
  Paper, Box, Typography, TextField
} from '@mui/material';
import { type Theme } from '@mui/material';

import { type IProtectedRange } from '@sheetxl/sdk';
import { useTranslator } from '@sheetxl/utils-react';
import { useModelSync } from '@sheetxl/react';

import { PasswordField } from '../protection/PasswordField';

import { AnchoredRangeField } from '../anchorItems';

import { stagedPasswords } from './ProtectedRangeDraft';

import styles from '../itemsPanel/Items.module.css';

export interface ProtectedRangeEditorPanelProps {
  /**
   * The protected range to edit.
   */
  protectedRange: IProtectedRange;
}

/**
 * Editor panel for a range that stays editable while the sheet is protected.
 */
export const ProtectedRangeEditorPanel = memo<ProtectedRangeEditorPanelProps>((props) => {
  const { protectedRange } = props;
  const t = useTranslator();

  useModelSync<IProtectedRange.IListeners>(protectedRange, 'onAnyChange');
  const readOnly = protectedRange.isProtected();

  const [name, setName] = useState<string>(() => protectedRange.getName());
  // The name this editor opened with — the one row a conflict check must ignore, since the item
  // being edited is a temporary copy and is never `===` its live counterpart.
  const [initialName] = useState<string>(() => protectedRange.getName());
  const [nameError, setNameError] = useState<string | null>(null);
  /* Whether this range will have a password when it saves: the source's own, unless the editor has
     staged a change. Read from the temporary item, which carries the source's hash. */
  const [hasPassword, setHasPassword] = useState<boolean>(() => protectedRange.hasPassword());

  /**
   * The live collection this item belongs to, for the uniqueness check.
   *
   * @remarks
   * The temporary item's own `setName` cannot enforce uniqueness — `createItem` builds it
   * against a CLONE of the map with the container callbacks nulled out, so the check that runs on a
   * live rename is absent here. Without this the model layer's last-resort auto-rename (which is
   * what makes the duplicate affordance work) would quietly replace a name the user typed.
   */
  const liveCollection = (() => {
    try {
      const ranges = protectedRange.getRanges();
      return ranges.isInvalid() ? null : ranges.getWorksheet().getProtectedRanges();
    } catch {
      return null;
    }
  })();

  const commitName = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('protectedRange.nameRequired'));
      return;
    }
    const conflict = liveCollection?.getItems({ name: trimmed })[0];
    if (conflict && conflict.getName().toLocaleLowerCase() !== initialName.toLocaleLowerCase()) {
      setNameError(t('protectedRange.nameTaken', { name: trimmed }));
      return;
    }
    if (trimmed === protectedRange.getName()) {
      setNameError(null);
      return;
    }
    try {
      protectedRange.setName(trimmed);
      setNameError(null);
    } catch (error: any) {
      setNameError(error?.message ?? t('protectedRange.nameRequired'));
    }
  };

  return (
    <Paper
      tabIndex={0}
      className={styles['editor-panel']}
      sx={{
        gap: (theme: Theme) => theme.spacing(1),
        paddingTop: (theme: Theme) => theme.spacing(1.25),
        paddingBottom: (theme: Theme) => theme.spacing(2),
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: (theme: Theme) => theme.spacing(1.25),
        overflow: 'auto'
      }}
    >
      {/* Section 1: Title */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: (theme: Theme) => theme.spacing(2),
          margin: (theme: Theme) => theme.spacing(1.25)
        }}
      >
        <TextField
          label={t('protectedRange.name')}
          size="small"
          fullWidth
          disabled={readOnly}
          value={name}
          error={nameError !== null}
          helperText={nameError ?? undefined}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value);
            setNameError(null);
          }}
          onBlur={commitName}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') commitName();
          }}
        />

        {/* Section 2: Range. Under the title, which is what the card is filed by — the range is
            what the entry DOES, and re-pointing it is the edit reached for most. */}
        <AnchoredRangeField item={protectedRange} label={t('protectedRange.applyTo')} />

        {/* Section 3: Password. Staged, never applied here — hashing is async and would race the
            Save button; the descriptor's `beforeSave` is what lands it. Unlike the sheet and the
            workbook, this item is a temporary copy that has committed nothing, so there is no
            current password to verify against — `requireCurrent` stays off. */}
        <PasswordField
          label={t('protectedRange.password')}
          description={t('protectedRange.passwordHelp')}
          hasPassword={hasPassword}
          disabled={readOnly}
          onSet={(next: string) => {
            setHasPassword(true);
            stagedPasswords.set(protectedRange, next);
          }}
          onClear={() => {
            setHasPassword(false);
            stagedPasswords.set(protectedRange, null);
          }}
        />

        {/* Section 4: Permissions (round-trip only, until identities land) */}
        {protectedRange.getSecurityDescriptor() ? (
          <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: 'italic' }}>
            {t('protectedRange.hasPermissions')}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
});

ProtectedRangeEditorPanel.displayName = 'ProtectedRangeEditorPanel';
