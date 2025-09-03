import React, { useState, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { TextField } from '@mui/material';

import {
  InputOptionsNotificationOptions, useCallbackRef, KeyCodes
} from '@sheetxl/utils-react';

import { type OptionsDialogProps } from './useOptionsDialog';
import { OptionsDialog } from './OptionsDialog';

export interface InputDialogProps extends InputOptionsNotificationOptions, OptionsDialogProps {};

const DEFAULT_INPUT_OPTIONS = ['Input'];
const InputDialog = memo(
  forwardRef<HTMLElement, InputDialogProps>((props, refForwarded) => {
  const {
    initialValue = '',
    onOption,
    onValidateOption,
    onInputOption,
    onValidateInputOption,
    onDone,
    inputProps: propInputProps,
    inputLabel,
    inputType,
    inputPlaceHolder,
    options = DEFAULT_INPUT_OPTIONS,
    autoFocusSel = `.autoFocus`,
    cancelOption,
    defaultOption = options?.[0],
    ...rest
  } = props;

  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const [input, setInput] = useState<string>(initialValue);
  const [helperText, setHelperText] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(true);

  const handleValidation = useCallbackRef(async (input?: string, option?: string): Promise<boolean> => {
    if (!onValidateInputOption) return true;
    const results = await onValidateInputOption?.(input, option);
    setHelperText(results?.message ?? '');
    const valid = results?.valid ?? true;
    setIsValid(valid);
    return valid;
  }, [onValidateInputOption]);

  const handleInput = useCallbackRef(async (option: string) => {
    onInputOption?.(input, option);
    // console.warn(new Error('onInput'));
    // onOption?.(option, option === cancelOption, option === defaultOption);
    // onDone?.();
  }, [input, onInputOption, onDone, onOption, cancelOption, defaultOption]);

  const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === KeyCodes.Enter) {
      let _valid = await handleValidation?.(input, null);
      // I commented this out because is was causing a race condition with OptionsDialog submit (due to the timeout)
      // if (valid !== false) {
      //   handleInput(defaultOption);
      // }
    }
  }, [input, handleInput]);

  const handleOnChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    handleValidation?.(e.target.value, null);
  }, [onValidateOption]);

  const handleValidateOption = useCallbackRef(async (option: string): Promise<boolean> => {
    let result = await handleValidation(input, option);
    try {
      if (result !== false)
        result = await handleValidation(input, option);
    } catch (e) {}
    return result ?? true;
  }, [input, onValidateOption]);

  return (
    <OptionsDialog
      options={options}
      onDone={onDone}
      onOption={(option: string, isCancel: boolean) => { if (!isCancel) handleInput(option) } }
      onValidateOption={handleValidateOption}
      cancelOption={cancelOption}
      defaultOption={defaultOption}
      autoFocusSel={autoFocusSel}
      ref={refForwarded}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0) // helper text spacing is already applied
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
          onFocus={(e) => {
            if (!firstFocus) {
              e.target?.select();
            }
            setFirstFocus(true);
          }}
          type={inputType}
          label={inputLabel}
          helperText={helperText || " "} // to force a space for text
          sx={{
            width: '100%',
            '& .MuiFormHelperText-root': {
              marginTop: (theme: Theme) => theme.spacing(0.5),
              color: !isValid ? 'error.main' : undefined
            }
          }}
          InputLabelProps={{
            shrink: true
          }}
          InputProps={{
            inputProps: {
              placeholder: inputPlaceHolder,
              spellCheck: false,
              autoComplete: "off",
              ...propInputProps,
              className: clsx('autoFocus', propInputProps?.className),
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1.25),
                paddingBottom: (theme: Theme) => theme.spacing(0.75),
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
              }
            }
          }}
          value={input}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>
      </Box>
    </OptionsDialog>
  );
}));

export default InputDialog;
