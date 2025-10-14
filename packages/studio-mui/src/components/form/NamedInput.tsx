import React, {
  memo, forwardRef, useState, useEffect, useCallback
} from 'react';

import clsx from 'clsx';

import { useFormContext, RegisterOptions } from 'react-hook-form';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { FormControl, FormControlProps } from '@mui/material';

import { TextField } from '@mui/material';

import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

export interface NamedInputProps extends FormControlProps {
  /**
   * The current value
   */
  value?: string;
  /**
   * INotifier of the value change
   */
  onChangeInput?: (value: string) => void;
  /**
   * If exception then throw error.
   *
   * @param text
   */
  onValidate?: (text: string) => void;
  /**
   * A default value.
   */
  defaultInput?: string;
  /**
   * If provided will register with react-hook-form.
   *
   * @remarks
   * We don't support changing the formName once rendered.
   * @see {@link https://react-hook-form.com}
   */
  formName?: string;
  /**
   * React-hook-form options.
   * @remarks
   * This is only used if formName is provided.
   */
  formOptions?: RegisterOptions;

  /**
   * Underling reference to the input element.
   */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * NamedItem input field.
 */
export const NamedInput = memo(forwardRef<HTMLDivElement, NamedInputProps>(
  (props: NamedInputProps, refForward) => {
  const {
    disabled: propDisabled,
    style: propStyle,
    className: propClassName,
    sx: propSx,
    defaultInput,
    value,
    formName,
    formOptions,
    onChangeInput,
    onValidate,
    onKeyDown,
    ...rest
  } = props;
  const formContext = useFormContext<any>(); // TODO - make this a generic types
  const formHandler = (formName && formContext) ? formContext.register(formName, formOptions) : null;

  const [focusedValue, setFocusedValue] = useState<string>('');
  const [errorText, setErrorText] = useState('');
  const [displayText, setDisplayText] = useState(value);

  useEffect(() => {
    setDisplayText(value);
    setErrorText('');
  }, [value]);

  const handleOnChangeDisplayText = useCallbackRef((asDisplayText: string) => {
    let error = '';
    try {
      setDisplayText(asDisplayText);
      onValidate?.(asDisplayText);
      onChangeInput?.(asDisplayText);
    } catch (e) {
      error = e.message ?? 'Invalid Name';
      // onChangeInput?.(asDisplayText);
    }

    if (formName && formContext) {
      if (error)
        formContext.setError(formName, { message: error });
      else
        formContext.clearErrors(formName);
    }
    setErrorText(error);
  }, [value, onValidate, onChangeInput]);

  const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === KeyCodes.Escape && focusedValue !== value) {
      handleOnChangeDisplayText(focusedValue);
      formContext?.setValue(formName, focusedValue);
      formContext?.clearErrors(formName);
      e.stopPropagation();
    }
    onKeyDown?.(e);
  }, [onKeyDown, focusedValue, value, formContext]);

  const handleFocus = useCallbackRef((e: React.FocusEvent<HTMLInputElement>) => {
    setFocusedValue(e.target.value ?? '');
  }, []);

  const handleBlur = useCallbackRef((e: React.FocusEvent<HTMLInputElement>) => {
    setFocusedValue('');
    formHandler?.onBlur(e);
  }, []);

  const handleOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleOnChangeDisplayText(e.target.value);
    formHandler?.onChange(e);
  }, [formHandler]);

  return (
    <FormControl
      sx={{
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        minWidth: 135, // TODO - make this dynamic
        width: '100%',
        ...propSx
      }}
      size="small"
      ref={refForward}
      className={clsx('named-input', propClassName)}
      {...rest}
    >
      <TextField
        label="Name"
        placeholder={defaultInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        inputRef={formHandler?.ref}
        disabled={propDisabled}
        error={errorText ? true : false}
        helperText={errorText || " "} // to force a space for text
        sx={{
          '& .MuiFormHelperText-root': {
            marginTop: (theme: Theme) => theme.spacing(0.5),
          }
        }}
        slotProps={{
          inputLabel: {
            shrink: true
          },
          htmlInput: {
            className: 'autoFocus',
            name: formName,
            spellCheck: false,
            autoComplete: "off",
            readOnly: propDisabled,
            sx: {
              paddingTop: (theme: Theme) => theme.spacing(1.25),
              paddingBottom: (theme: Theme) => theme.spacing(0.75),
              backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
            }
          }
        }}
        value={displayText ?? ''}
        onChange={handleOnChange}
        onKeyDownCapture={handleKeyDown}
        onContextMenu={(e) => { e.stopPropagation(); }}
      />
    </FormControl>
  );
}));

NamedInput.displayName = "NamedInput";