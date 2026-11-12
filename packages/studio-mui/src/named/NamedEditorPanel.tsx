import type React from 'react';
import { memo, useState, useMemo } from 'react';

import {
  Paper, Box, Typography, TextField, MenuItem, FormControlLabel, Checkbox, FormHelperText
} from '@mui/material';
import { type Theme } from '@mui/material';

import { type IWorkbook, type ICalculation } from '@sheetxl/sdk';

import { useTranslator, useCallbackRef } from '@sheetxl/utils-react';

import { FormulaField, InputField } from '../form';

import { type NamedDraft } from './NamedDraft';
import { NamedKindChip, namedKindOfExpression, type NamedKind } from './NamedKindChip';

import styles from '../itemsPanel/Items.module.css';

/** The `<MenuItem>` value standing in for `scope: null`. `''` would collide with a blank option. */
const SCOPE_WORKBOOK = '\u0001workbook';

export interface NamedEditorPanelProps {
  /**
   * The working value to edit. Written through on every change — the panel saves this object.
   */
  draft: NamedDraft;
  workbook: IWorkbook;
}

/**
 * Editor panel for one defined name: its name, expression, scope, comment and visibility.
 *
 * @remarks
 * Writes straight through to {@link NamedDraft} while mirroring each field in local state to
 * render — the draft is a plain object, so it cannot notify anything on its own.
 */
export const NamedEditorPanel = memo<NamedEditorPanelProps>((props) => {
  const { draft, workbook } = props;
  const t = useTranslator();

  // Seeded ONCE, never echoed back: the fields own their own text (they re-derive only when `value`
  // CHANGES), and feeding every keystroke back through `value` would re-base the committed baseline
  // each time — defeating their own dirty tracking and Escape-to-revert.
  const [initialName] = useState<string>(() => draft.name);
  const [initialExpression] = useState<string>(() => draft.expression);
  const [nameError, setNameError] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(() => draft.scope);
  const [comment, setComment] = useState<string>(() => draft.comment);
  const [hidden, setHidden] = useState<boolean>(() => draft.hidden);
  // What the expression as typed would DEFINE — the glyph follows the text, so a reader sees a
  // range become a formula the moment the text stops being a bare reference.
  const [kind, setKind] = useState<NamedKind>(() => (
    draft.editable ? namedKindOfExpression(workbook, draft.expression) : 'table'
  ));

  const readOnly = !draft.editable;

  // Keeping the name it opened with is never a clash — the same exemption `saveNamedDraft` makes.
  // Checked in the draft's current scope: a sheet-scoped name may share a global name's text.
  const validateName = useCallbackRef((text: string): void => {
    if (text.trim().toLowerCase() === initialName.toLowerCase()) return;
    workbook.getNames().validateName(text.trim(), scope ?? undefined);
  }, [workbook, initialName, scope]);

  const sheetNames = useMemo(() => {
    try {
      return workbook.getWorksheets().getItems().map((sheet) => sheet.getName());
    } catch (error: any) {
      return [];
    }
  }, [workbook]);

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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: (theme: Theme) => theme.spacing(2),
          margin: (theme: Theme) => theme.spacing(1.25)
        }}
      >
        {/* The same header the card shows — the kind glyph beside what the name IS, what it refers
            to beneath — so moving from the list into the editor does not rearrange what the user
            was reading. The chip is larger here; the editor can afford it. */}
        <Box>
          <Box sx={{
            display: 'flex',
            // Bottom-aligned: the floating label gets the room above the input, and the error line
            // below starts flush under both the chip and the field.
            alignItems: 'flex-end',
            gap: (theme: Theme) => theme.spacing(1.5)
          }}>
            <NamedKindChip kind={kind} size={48} />
            <InputField
              label={t('named.name')}
              sx={{ flex: '1 1 auto', minWidth: 0 }}
              // No line under the field, so its bottom meets the chip's; the error is shown below the
              // whole row instead.
              helperText={null}
              showError={false}
              onChangeError={setNameError}
              disabled={readOnly}
              value={initialName}
              onValidate={validateName}
              // The RAW text, for the same reason as the expression: Save validates the draft, so it
              // must hold what the field shows, invalid states included.
              onChangeText={(text: string) => { draft.name = text; }}
            />
          </Box>
          {/* Always rendered — a space when valid — so an error appearing never shifts the layout. */}
          <FormHelperText error={!!nameError} sx={{ marginTop: (theme: Theme) => theme.spacing(0.5), marginX: '14px' }}>
            {nameError ? t(nameError) : ' '}
          </FormHelperText>
        </Box>

        <FormulaField
          label={t('named.refersTo')}
          // The FORMULA grammar (the default), not `'reference'`: a name's refers-to is any
          // expression — a constant, a list, OFFSET/INDIRECT — of which "a range" is just the common
          // case. Unanchored (no `home`), so references stay fully sheet-qualified: a name is read
          // from wherever it is used, not from the tab that happens to be showing.
          value={initialExpression}
          workbook={workbook}
          disabled={readOnly}
          helperText={t('named.refersToHelp')}
          // The `=` is part of the contract here, not a convenience: what a name refers to is a
          // FORMULA (`=Sheet1!$A$1`), so the field shows one and rejects text without it rather than
          // silently accepting a bare address. `saveNamedDraft` normalizes it back off for the model.
          equals="required"
          // A name denotes a FIXED region — not one relative to whoever reads it — so a pick lands
          // absolute (`$A$1:$B$2`), Excel's default here. Only a default: typing and F4 still reach
          // the relative form, and an existing name keeps the fixability it was defined with.
          pickAs="absolute"
          // The RAW text, not the parsed value: the draft is what `saveNamedDraft` validates, so it
          // has to hold exactly what the user is looking at. On `onChangeInput` an invalid
          // in-progress expression would leave the draft on the last VALID text, and Save would
          // quietly write something the field never showed.
          onChangeText={(text: string) => { draft.expression = text; }}
          // The glyph, on the other hand, wants only VALID states: an expression mid-keystroke is
          // neither a range nor a formula yet, and the chip holds what it last was.
          onChangeInput={(value: ICalculation.IFormula | null) => {
            if (value) setKind(value.isReferenceOnly() ? 'range' : 'formula');
          }}
        />

        <TextField
          label={t('named.scope')}
          size="small"
          fullWidth
          select
          disabled={readOnly}
          value={scope ?? SCOPE_WORKBOOK}
          helperText={t('named.scopeHelp')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const next = e.target.value === SCOPE_WORKBOOK ? null : e.target.value;
            setScope(next);
            draft.scope = next;
          }}
        >
          <MenuItem value={SCOPE_WORKBOOK}>{t('named.scopeWorkbook')}</MenuItem>
          {sheetNames.map((sheetName: string) => (
            <MenuItem key={sheetName} value={sheetName}>{sheetName}</MenuItem>
          ))}
        </TextField>

        <TextField
          label={t('named.comment')}
          size="small"
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          disabled={readOnly}
          value={comment}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setComment(e.target.value);
            draft.comment = e.target.value;
          }}
        />

        <FormControlLabel
          control={(
            <Checkbox
              size="small"
              disabled={readOnly}
              checked={hidden}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setHidden(e.target.checked);
                draft.hidden = e.target.checked;
              }}
            />
          )}
          label={(
            <Typography variant="body2">{t('named.hidden')}</Typography>
          )}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', marginTop: '-12px' }}>
          {t('named.hiddenHelp')}
        </Typography>

        {readOnly ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            {t('named.derivedReadOnly')}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
});

NamedEditorPanel.displayName = 'NamedEditorPanel';
