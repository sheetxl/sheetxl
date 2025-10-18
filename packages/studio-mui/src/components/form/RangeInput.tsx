import React, {
  memo, forwardRef, useState, useEffect, useCallback, useMemo
} from 'react';

import clsx from 'clsx';

import { useFormContext, RegisterOptions } from 'react-hook-form';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { FormControl, FormControlProps } from '@mui/material';
import {InputAdornment } from '@mui/material';
import { TextField } from '@mui/material';

import { ICellRanges } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes, DynamicIcon } from '@sheetxl/utils-react';
import { ExhibitOptionButton } from '@sheetxl/utils-mui';

export interface RangeInputProps extends FormControlProps {
  /**
   * If provided will be register with react-hook-form.
   *
   * @remarks
   * We don't support changing the formName once rendered.
   * @see
   * {@link https://react-hook-form.com/}
   */
  formName?: string;
  /**
   * React-hook-form options.
   *
   * @remarks
   * Only used if formName is provided.
   */
  formOptions?: RegisterOptions;
  /**
   * The current value.
   */
  value: ICellRanges;
  /**
   * INotifier of the value change. If unable to parse the Range will notify with `null`.
   */
  onChangeInput?: (value: ICellRanges | null) => void;
  /**
   * Required to create ranges.
   *
   * @param address
   */
  resolvedAddress: (address: ICellRanges.Address) => ICellRanges;
  /**
   * Reference to the element.
   */
  ref?: React.Ref<HTMLDivElement>;
}

/** `null` safe toString. */
const toStringWithEmpty = (value: ICellRanges): string => {
  if (value === null) return '';
  return value.toString();
}

/**
 * Range input field.
 */
export const RangeInput = memo(forwardRef<HTMLDivElement, RangeInputProps>(
  (props: RangeInputProps, refForwarded) => {
  const {
    formName,
    formOptions,
    disabled: propDisabled,
    style: propStyle,
    className: propClassName,
    sx: propSx,
    onKeyDown,
    value,
    onChangeInput,
    resolvedAddress,
    ...rest
  } = props;
  const formContext = useFormContext<any>(); // TODO - make this a generic types
  const formHandler = (formName && formContext) ? formContext.register(formName, formOptions) : null;

  const [errorText, setErrorText] = useState<string>(''); // TODO - this is in the formState we can remove here
  const [isDirty, setDirty] = useState<boolean>(false); // Note - This is not the dirty state of the form but the dirty state of the ui component.
  const [displayText, setDisplayText] = useState<string>(() => {
    return toStringWithEmpty(value);
  });

  useEffect(() => {
    setDisplayText(toStringWithEmpty(value));
    setErrorText('');
    if (formName && formContext) {
      formContext.clearErrors(formName);
    }
    setDirty(false);
  }, [value]);

  const handleOnChangeDisplayText = useCallbackRef((asDisplayText: string) => {
    let error = '';
    try {
      setDisplayText(asDisplayText);
      const originalText = toStringWithEmpty(value);
      const newRanges:ICellRanges = resolvedAddress(asDisplayText);
      if (newRanges.toString() !== originalText) {
        onChangeInput?.(newRanges);
      }
    } catch (e) {
      // error = e.message ?? 'Invalid Range';
      // this would give a nicer message but I dialog is too small at the moment.
      error = 'Invalid Range';
      // onChangeInput?.(null);
    }
    if (formName && formContext) {
      if (error)
        formContext.setError(formName, { message: error });
      else
        formContext.clearErrors(formName);
    }
    setErrorText(error);
    setDirty(true);
  }, [displayText, onChangeInput, formName, formContext]);

  const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDirty && e.keyCode === KeyCodes.Escape) {
      const originalValueAsText = toStringWithEmpty(value); // original value
      setDisplayText(originalValueAsText);
      setErrorText('');
      setDirty(false);
      e.stopPropagation();
    }
    onKeyDown?.(e);
  }, [value, onChangeInput, onKeyDown, isDirty]);

  const handleBlur = useCallbackRef((e: React.FocusEvent<HTMLInputElement>) => {
    formHandler?.onBlur(e);
  }, [formHandler]);

  const handleOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleOnChangeDisplayText(e.target.value);
    formHandler?.onChange(e);
  }, [formHandler]);

  const [isRangeSelect, setRangeSelect] = useState<boolean>(false);
  const endAdornment = useMemo(() => {
    return (
      <InputAdornment
        tabIndex={-1}
        sx={{
          display: 'flex',
          position: 'relative',
          flex: '0'
          // opacity: searchInputText.length > 0 ? 1 : 0,
          // display: searchInputText.length > 0 ? 'flex' : 'none',
          // transform: 'scale(0.75) translateX(16px)'
        }}
        position="end"
      >
      <ExhibitOptionButton
        disabled={true} // for now
        selected={isRangeSelect}
        onSelectToggle={(value: boolean) => {
          setRangeSelect(value);
        }}
        label="Select Range"
        // shortcut={{ key: 'C', modifiers: [KeyModifiers.Alt] }}
        icon={<DynamicIcon iconKey="SelectRangeMode" />}
      />
      </InputAdornment>
    )
  }, [isRangeSelect]);

  return (
    <FormControl
      sx={{
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        minWidth: 135, // TODO - make this dynamic
        width: '100%',
        ...propSx
      }}
      size="small"
      ref={refForwarded}
      className={clsx('range-input', propClassName)}
      {...rest}
    >
      <TextField
        label="Range"
        placeholder={"Enter Range"}
        onBlur={handleBlur}
        disabled={propDisabled}
        error={errorText ? true : false}
        inputRef={formHandler?.ref}
        helperText={errorText || " "} // to force a space for text
        sx={{
          // flex: '1 1 100%',
          // marginTop:  (theme: Theme) => theme.spacing(0.75),
          '& .MuiFormHelperText-root': {
            marginTop: (theme: Theme) => theme.spacing(0.5),
          }
        }}
        slotProps={{
          input: {
            endAdornment
          },
          inputLabel: {
            shrink: true,
          },
          htmlInput: {
            // className: 'input',
            spellCheck: false,
            autoComplete: "off",
            readOnly: propDisabled,
            name: formName,
            sx: {
              paddingTop: (theme: Theme) => theme.spacing(1.25),
              paddingBottom: (theme: Theme) => theme.spacing(0.75)
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

RangeInput.displayName = "RangeInput";