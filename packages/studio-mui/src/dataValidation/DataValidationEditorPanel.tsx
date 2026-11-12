import type React from 'react';
import { memo, useState } from 'react';

import {
  Paper, Box, Typography, TextField, FormControl, FormControlLabel, Checkbox,
  Select, MenuItem, InputLabel, Tabs, Tab
} from '@mui/material';
import { type Theme } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IDataValidation } from '@sheetxl/sdk';
import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';
import { useModelSync } from '@sheetxl/react';

import { AnchoredRangeField } from '../anchorItems';
import { ConditionEditor, SxConditionEditorFrame } from '../conditions';
import { FormulaFrameContext } from '../conditions/useFormulaOption';

import styles from '../itemsPanel/Items.module.css';

import { DataValidationIcon } from './DataValidationIcon';
import { dataValidationTitle } from './DataValidationTitle';

/*
 * Excel's authoring limits. Reasonable lengths for a prompt and an alert, so the
 * editor keeps them; the model stores whatever it is given, and the xlsx writer cuts each message
 * to the file's 255 on export.
 */
const MAX_TITLE_LENGTH = 32;
const MAX_PROMPT_LENGTH = 254;
const MAX_ALERT_LENGTH = 225;

/** The icon of each alert style, on the editor's style menu and the card's badge alike. */
export const ALERT_STYLE_ICONS: Record<IDataValidation.AlertStyle, string> = {
  [IDataValidation.AlertStyle.Stop]: 'ValidationStop',
  [IDataValidation.AlertStyle.Warning]: 'ValidationWarning',
  [IDataValidation.AlertStyle.Information]: 'ValidationInformation'
};

/** The fourth answer to an invalid entry: none. The entry is accepted and the cell only marked. */
const ALERT_NONE = 'none';

/** Where a style's icon sits, kept empty for the choice that has none, so the words line up. */
const SxIconPlace = { width: 18, height: 18, flex: '0 0 auto' } as const;

const ALERT_STYLE_MESSAGE_KEYS: Record<IDataValidation.AlertStyle, string> = {
  [IDataValidation.AlertStyle.Stop]: messageKey('dataValidation.alertStop'),
  [IDataValidation.AlertStyle.Warning]: messageKey('dataValidation.alertWarning'),
  [IDataValidation.AlertStyle.Information]: messageKey('dataValidation.alertInformation')
};

export interface DataValidationEditorPanelProps {
  /**
   * The data validation to edit
   */
  dataValidation: IDataValidation;
}

/**
 * Editor for one data validation: the card's header, then two tabs. The Rule
 * tab is the rule: the condition, through the editor conditional formats and filters use; for a
 * rule that offers a list, its in-cell dropdown; and the error alert, which is what the rule
 * does when an entry fails. The Prompt tab is the input message, which is not part of the rule
 * at all (a note shown on selection, with or without a condition), so it does not sit among the
 * rule's parts (Michael, 2026-10-14; Excel's third tab is this one).
 *
 * @remarks
 * A later shape makes the prompt a card of its own, beside the validation rather than inside it.
 */
export const DataValidationEditorPanel = memo<DataValidationEditorPanelProps>((props) => {
  const { dataValidation } = props;
  const t = useTranslator();

  useModelSync<IDataValidation.IListeners>(dataValidation, 'onAnyChange');
  const readOnly = dataValidation.isProtected();
  const offersList = dataValidation.getRenderHints().includes('list');
  const [tab, setTab] = useState<'rule' | 'prompt'>('rule');

  const panel = (
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
      {/* The same header the card shows, laid out as the conditional-format editor's: the glyph
          beside what the rule checks, its ranges beneath. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          // The field's floating label rides above its box, so it needs more clearance from the
          // row over it than a plain input would.
          gap: (theme: Theme) => theme.spacing(1.75),
          margin: (theme: Theme) => theme.spacing(1.25),
          marginBottom: 0
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: (theme: Theme) => theme.spacing(1.5)
        }}>
          <DataValidationIcon dataValidation={dataValidation} size={48} />
          <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
            {dataValidationTitle(dataValidation, t)}
          </Typography>
        </Box>
        <AnchoredRangeField item={dataValidation} label={t('dataValidation.applyTo')} />
      </Box>

      <Tabs
        value={tab}
        onChange={(_, next: 'rule' | 'prompt') => setTab(next)}
        // As the conditional-format pane's tabs: the words as written, not shouted.
        sx={{
          minHeight: '36px',
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: '36px', textTransform: 'none', pt: 0.5, pb: 0.5, px: 1.5, minWidth: 0 }
        }}
      >
        <Tab value="rule" label={t('dataValidation.tabRule')} />
        <Tab value="prompt" label={t('dataValidation.prompt')} />
      </Tabs>

      {tab === 'prompt' ? (
      /* The prompt is its own thing on its own tab: whether it shows, and what it says. Nothing
         to fold away, so a plain checkbox, not a section that opens and closes. */
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dataValidation.isShowPromptMessage()}
              disabled={readOnly}
              onChange={(e) => dataValidation.setShowPromptMessage(e.target.checked)}
            />
          }
          label={t('dataValidation.showPrompt')}
          // Lined up with the fields under it: the label's own negative inset would hang it out left.
          sx={{ ml: 0, pl: 0.5 }}
        />
        <TextField
          size="small"
          label={t('dataValidation.title')}
          value={dataValidation.getPromptTitle()}
          onChange={(e) => dataValidation.setPromptTitle(e.target.value)}
          disabled={readOnly}
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_TITLE_LENGTH } }}
          sx={{ backgroundColor: 'background.paper' }}
        />
        <TextField
          size="small"
          label={t('dataValidation.message')}
          value={dataValidation.getPromptMessage()}
          onChange={(e) => dataValidation.setPromptMessage(e.target.value)}
          disabled={readOnly}
          multiline
          rows={2}
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_PROMPT_LENGTH } }}
          sx={{ backgroundColor: 'background.paper' }}
        />
      </Box>
      ) : (<>
      <ConditionEditor
        // No bottom padding: the last row is the blanks checkbox, which carries its own.
        sx={{ ...SxConditionEditorFrame, p: 2, pb: 0 }}
        // Allow lists the selectors and nothing else. Excel's "List" row is not a type: it is
        // any value, one of a set, which is "List" under Any.
        selectorTitle={t('dataValidation.allow')}
        condition={dataValidation.getCondition()}
        ranges={dataValidation.getRanges()}
        readOnly={readOnly}
        onConditionChange={(newCondition) => {
          // A validation that gains its first condition lets blanks through, as a new rule in
          // Excel does (Ignore blank). The host's default, not the condition's: a filter and a
          // format judge a blank unless told otherwise.
          const next = !dataValidation.getCondition() && newCondition
            ? { ...newCondition, includeBlanks: true }
            : newCondition;
          dataValidation.setCondition(next);
        }}
        // Only a rule that offers a list has a dropdown to show; for any other type the setting
        // would do nothing. It qualifies the list, so it sits beside Ignore Blank.
        qualifiers={offersList ? (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!dataValidation.isHideDropdown()}
                disabled={readOnly}
                onChange={(e) => dataValidation.setHideDropdown(!e.target.checked)}
              />
            }
            label={t('dataValidation.inCellDropdown')}
          />
        ) : null}
      />

      {/* What happens on an invalid entry: Excel's checkbox and style dropdown are one four-way
          choice (Stop refuses, Warning asks, Information tells, none accepts and only marks the
          cell), so they read as one. The model keeps both the flag and the style, as the file does. */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1
      }}>
        <FormControl fullWidth size="small" disabled={readOnly} sx={{ backgroundColor: 'background.paper' }}>
          <InputLabel>{t('dataValidation.onInvalid')}</InputLabel>
          <Select
            className="on-invalid"
            value={dataValidation.isShowAlertMessage() ? dataValidation.getAlertStyle() : ALERT_NONE}
            label={t('dataValidation.onInvalid')}
            onChange={(e) => {
              const choice = e.target.value as IDataValidation.AlertStyle | typeof ALERT_NONE;
              if (choice === ALERT_NONE) {
                dataValidation.setShowAlertMessage(false);
                return;
              }
              dataValidation.setAlertStyle(choice);
              dataValidation.setShowAlertMessage(true);
            }}
            renderValue={(choice: IDataValidation.AlertStyle | typeof ALERT_NONE) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {choice === ALERT_NONE ? <Box sx={SxIconPlace} /> : <DynamicIcon iconKey={ALERT_STYLE_ICONS[choice]} size={18} ariaHidden />}
                {choice === ALERT_NONE ? t('dataValidation.alertNone') : t(ALERT_STYLE_MESSAGE_KEYS[choice])}
              </Box>
            )}
          >
            {(Object.keys(ALERT_STYLE_ICONS) as IDataValidation.AlertStyle[]).map((style) => (
              <MenuItem key={style} value={style} sx={{ gap: 1 }}>
                <DynamicIcon iconKey={ALERT_STYLE_ICONS[style]} size={18} ariaHidden />
                {t(ALERT_STYLE_MESSAGE_KEYS[style])}
              </MenuItem>
            ))}
            <MenuItem key={ALERT_NONE} value={ALERT_NONE} sx={{ gap: 1 }}>
              <Box sx={SxIconPlace} />
              {t('dataValidation.alertNone')}
            </MenuItem>
          </Select>
        </FormControl>
        {dataValidation.isShowAlertMessage() ? (
          <>
            <TextField
              size="small"
              label={t('dataValidation.title')}
              value={dataValidation.getAlertTitle()}
              onChange={(e) => dataValidation.setAlertTitle(e.target.value)}
              disabled={readOnly}
              fullWidth
              slotProps={{ htmlInput: { maxLength: MAX_TITLE_LENGTH } }}
              sx={{ backgroundColor: 'background.paper' }}
            />
            <TextField
              size="small"
              label={t('dataValidation.message')}
              value={dataValidation.getAlertMessage()}
              onChange={(e) => dataValidation.setAlertMessage(e.target.value)}
              disabled={readOnly}
              multiline
              rows={2}
              fullWidth
              slotProps={{ htmlInput: { maxLength: MAX_ALERT_LENGTH } }}
              sx={{ backgroundColor: 'background.paper' }}
            />
          </>
        ) : null}
      </Box>
      </>)}
    </Paper>
  );

  // Formulas in this editor are typed and read at the active cell, stored at the rule's anchor.
  return (
    <FormulaFrameContext.Provider value={dataValidation}>
      {panel}
    </FormulaFrameContext.Provider>
  );
});

DataValidationEditorPanel.displayName = 'DataValidationEditorPanel';
