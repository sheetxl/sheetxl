import type React from 'react';
import { memo, useState } from 'react';

import { Box, Checkbox, FormControlLabel, type Theme } from '@mui/material';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

export interface OutlineSettingsDialogProps extends InputDialogProps<CommandContext.OutlineSettings> {};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * Excel's Data → Outline settings: where summary rows and columns sit, and whether the automatic
 * outline styles apply. The `outlineSettings` command opens it and commits its `onInput`.
 */
export const OutlineSettingsDialog = memo<OutlineSettingsDialogProps>((props: OutlineSettingsDialogProps) => {
  const {
    initialValue,
    onOption,
    onValidateOption,
    onInput,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  const [input, setInput] = useState<CommandContext.OutlineSettings>(initialValue ?? {
    summaryBelow: true, summaryRight: true, automaticStyles: false
  });

  const handleInput = useCallbackRef(async (option: OptionInput) => {
    const isCancel = option === cancelOption;
    if (!isCancel) {
      onInput?.(input, option);
    }
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.();
  }, [input, onInput, onDone, onOption, cancelOption, defaultOption]);

  const check = (key: keyof CommandContext.OutlineSettings, label: string): React.ReactElement => (
    <FormControlLabel
      key={key}
      className={key === 'summaryBelow' ? 'autoFocus' : undefined}
      control={
        <Checkbox
          size="small"
          checked={input[key]}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput({ ...input, [key]: e.target.checked })}
        />
      }
      label={label}
    />
  );

  return (
    <OptionsDialog
      title={t('outlineSettings.title')}
      options={options}
      onDone={onDone}
      onOption={(option: OptionInput) => handleInput(option)}
      onValidateOption={onValidateOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus input'}
      sx={{
        width: '340px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingBottom: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {check('summaryBelow', t('outlineSettings.summaryBelow'))}
        {check('summaryRight', t('outlineSettings.summaryRight'))}
        {check('automaticStyles', t('outlineSettings.automaticStyles'))}
      </Box>
    </OptionsDialog>
  );
});

OutlineSettingsDialog.displayName = 'OutlineSettingsDialog';

export default OutlineSettingsDialog;
