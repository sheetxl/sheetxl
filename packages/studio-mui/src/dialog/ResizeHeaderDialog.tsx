import type React from 'react';
import { useState, useMemo, memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';
import { Select, type SelectChangeEvent } from '@mui/material';

import { IRange } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

export interface ResizeHeaderDialogProps extends InputDialogProps<CommandContext.ResizeHeaderOptions, CommandContext.ResizeHeaderContext> {};

const DEFAULT_INPUT_OPTIONS = ['Autofit', 'Ok', 'Cancel'];

/**
 * * TODO
 * * Allow for entering in character units
 * * Show realtime conversion from native to pixels.
 * * 0 is hidden - show a little indicate that this is hidden
 * * validation - max size is based on header and unit
 */
export const ResizeHeaderDialog = memo<ResizeHeaderDialogProps>((props: ResizeHeaderDialogProps) => {
  const {
    initialValue,
    context,
    onOption,
    onValidateOption,
    onInput,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[1], // ok, not first
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  const isColumn = useMemo(() => {
    return context?.().getAxis() === IRange.Axis.Column;
  }, [context]);

  const [input, setInput] = useState<CommandContext.ResizeHeaderOptions>(initialValue ?? { size: 0 });
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const onValidateInputOption = useCallback(async (_input?: CommandContext.ResizeHeaderOptions, _option?: OptionInput): Promise<boolean> => {
    // TODO - do validation of format
    return true;
  }, []);

  // Should convert to other
  const asOther = useMemo(() => {
    const ctx = context?.();
    if (!ctx?.toUnits) {
      return null;
    }
    let size = input?.size ?? 0;
    let unit: string = 'Px';
    if (input.unit === 'Px') {
      size = ctx.toUnits?.(size) ?? size;
      unit = ctx.getUnitText();
    } else {
      size = ctx.toPixels?.(size) ?? size;
      unit = 'Px';
    }
    return { size, unit }
  }, [input?.unit, input?.size]);

  const handleInput = useCallbackRef(async (option: OptionInput) => {
    const isCancel = option === cancelOption;
    if (!isCancel) {
      onInput?.(input, option);
    }
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.();
  }, [input, onInput, onDone, onOption, cancelOption, defaultOption]);

  const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === KeyCodes.Enter) {
      let valid = await onValidateInputOption?.(input);
      if (valid !== false)
        handleInput(defaultOption);
    }
  }, [input, handleInput]);

  const handleValidateOption = useCallbackRef(async (option?: OptionInput): Promise<boolean> => {
    let result = await Promise.resolve(onValidateOption?.(option));
    try {
      if (result !== false)
        result = (await Promise.resolve(onValidateInputOption?.(input, option))) ?? true;
    } catch (e) {}
    return result ?? true;
  }, [onValidateOption]);


  const handleOnTextChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    const asNewInput = { ...input, size: Number(e.target.value) }
    setInput(asNewInput);
    onValidateInputOption?.(asNewInput);
  }, [input, onValidateOption]);

  const handleUnitChange = useCallbackRef((event: SelectChangeEvent<string>) => {
    const unit:string = event.target.value;
    // TODO - should this change the value here in line? Probably
    const asNewInput = { ...input, unit }
    setInput(asNewInput);
  }, [input]);

  const optionsUnit = useMemo(() => {
    const units = context?.().getUnitText() ?? '';
    const createOption = (value: string) => {
      return (
        <MenuItem
          key={value}
          value={value}
        >
          {value}
        </MenuItem>
      );
    }
    const options = [];
    options.push(createOption('Px'));
    options.push(createOption(units));
    return options;
  }, []);

  // 'Autofit' stays the identity (the command compares it); only its label is localized here.
  const localizedOptions = useMemo(() => options.map((o) =>
    o === 'Autofit' ? { id: 'Autofit', label: () => t('resizeHeader.autofit') } : o
  ), [options, t]);

  return (
    <OptionsDialog
      title={isColumn ? t('resizeHeader.titleColumns') : t('resizeHeader.titleRows')}
      options={localizedOptions}
      onDone={onDone}
      onOption={(option: OptionInput) => handleInput(option) }
      onValidateOption={handleValidateOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      sx={{
        width: '380px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(0),
          paddingBottom: (theme: Theme) => theme.spacing(1), // helper text spacing is already applied
          // rowGap: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            rowGap: (theme: Theme) => theme.spacing(1),
            display: 'flex',
            flexDirection: 'row',
            gap: (theme: Theme) => theme.spacing(0.5),
            alignItems: 'end',
            justifyContent: 'center'
          }}
        >
          <FormControl
            sx={{
              paddingTop: (theme: Theme) => theme.spacing(1.5),
              minWidth: 135, // TODO - make this dynamic
              width: '100%'
            }}
            size="small"
          >
          <TextField
            label={t('resizeHeader.size')}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
              if (!firstFocus) {
                e.target?.select();
              }
              setFirstFocus(true);
            }}
            sx={{
              '& .MuiFormHelperText-root': {
                marginTop: (theme: Theme) => theme.spacing(0.5)
              }
            }}
            slotProps={{
              inputLabel: {
                shrink: true
              },
              htmlInput: {
                className: 'autoFocus',
                spellCheck: false,
                autoComplete: "off",
                type: 'number',
                inputMode: 'numeric',
                min: 0,
                // max: 100, // this need to be dynamic
                pattern: '[0-9]*',
                // needed to override the default padding of 16px
                // when using small size (which is 8px)
                // see
                sx: {
                  paddingTop: (theme: Theme) => theme.spacing(1.25),
                  paddingBottom: (theme: Theme) => theme.spacing(0.75)
                }
              }
            }}
            value={input.size}
            onChange={handleOnTextChange}
            onKeyDown={handleKeyDown}
            onContextMenu={(e) => { e.stopPropagation(); }}
          />
          </FormControl>
          <FormControl
            sx={{
              minWidth: 85, // TODO - make this dynamic
            }}
            size="small"
          >
            <InputLabel>
              {t('resizeHeader.unit')}
            </InputLabel>
            <Select
              value={input.unit}
              label={t('resizeHeader.unit')}
              onChange={handleUnitChange}
            >
              {optionsUnit}
            </Select>
          </FormControl>
        </Box>
        {asOther && (
          <Box>
          <Typography
            variant="body2"
            component='div'
            sx={{
              paddingLeft: (theme: Theme) => theme.spacing(2)
            }}
          >
            {asOther.size} {asOther.unit}
          </Typography>
        </Box>
      )}
      </Box>
    </OptionsDialog>
  );
});

export default ResizeHeaderDialog;
