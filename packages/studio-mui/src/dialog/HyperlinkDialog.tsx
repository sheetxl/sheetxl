import React, { useState, useMemo, memo, useCallback } from 'react';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';

import { TextField } from '@mui/material';

import { ICell, IHyperlink } from '@sheetxl/sdk';

import { useCallbackRef } from '@sheetxl/utils-react';

import { OptionsDialog, InputDialogProps } from '@sheetxl/utils-mui';

export interface HyperlinkDialogProps extends InputDialogProps<IHyperlink.Modifiers | string, ICell> {};


const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * Hover should include (a goto with fun icon, copy, edit, and remove)
 *
 * ZOHO has a decent insert hyperlink dialog.
 * Excel online does this as a radio option (url, sheetReference, or email) (would later like to include links to people or any object?)
 * Google sheets has a little world icon for url, we could have a sheet icon for sheet reference.

 *
 * * Determine how to store links.
 * * Allow for cell references or other urls. (should we store cells references as url?)
 * * validate and read url to determine the display name (from fetch?)
 * * Support for remove
 * * ui to show insert or remove
 * * Excel also allows for tooltip (screenTip)
 */
export const HyperlinkDialog: React.FC<HyperlinkDialogProps> = memo((props) => {
  const {
    initialValue = null,
    context,
    onInput,
    onOption,
    onValidateOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const isInsert = useMemo(() => {
    return (initialValue ?? context?.()?.getHyperlink()) !== null;
  }, []);

  const hyperlink:IHyperlink.Modifiers = useMemo(() => {
    let initialHyperlinkResolve = null;
    let initialHyperlinkString = null;
    if (initialValue) {
      if (typeof initialValue === 'string') {
        initialHyperlinkString = initialValue;
      } else {
        initialHyperlinkResolve = initialValue;
      }
    }
    const iHyperlink:IHyperlink = initialHyperlinkResolve ?? context?.()?.getHyperlink();
    let retValue = {
      address: initialHyperlinkString ?? iHyperlink?.getAddress() ?? '',
      textToDisplay: iHyperlink?.getDisplayText() ?? ''
    }
    return retValue;
  }, [initialValue, context]);

  const [address, setAddress] = useState<string>(hyperlink.address);
  const [displayText, setDisplayText] = useState<string>(() => {
    // if no address we treat the display as an input value;
    const initialValue = context?.().toTextUnformatted() ?? hyperlink.displayText;
    // If the displayValue is the same as the address then we don't want to show it as it was the default.
    if (initialValue === hyperlink.address)
      return '';
    return initialValue;
  });
  // TODO - add support for tooltip editing

  // const [textFieldProps, setTextFieldProps] = useState<TextFieldProps>(null);
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const handleOnDisplayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayText(e.target.value);
  }, []);

  const handleValidation = useCallback(async (_input?: string, _option?: string): Promise<boolean> => {
    // TODO - Border Color (and perhaps tooltip on invalid)
    // return TextUtils.isValidHttpUrl(input);
    return null;
  }, []);

  const handleHyperlink = useCallbackRef(async (option: string) => {
    const hyperlink = address === '' ? null : {
      address
    }
    const isCancel = option === cancelOption;
    if (!isCancel) {
      onInput?.({
        address: hyperlink?.address ?? null,
        displayText: displayText ?? null
      });
    }
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.();
  }, [address, displayText, context, onInput, onDone, onOption, defaultOption, cancelOption]);

  // const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (e.keyCode === KeyCodes.Enter) {
  //     let valid = await handleValidation(address, null);
  //     if (valid !== false)
  //     handleHyperlink(defaultOption);
  //   }
  // }, [address, handleHyperlink]);

  const handleOnAddressChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    handleValidation(e.target.value, null);
  }, [onValidateOption]);

  const handleValidateAddress = useCallbackRef(async (option: string): Promise<boolean> => {
    let result = await Promise.resolve(onValidateOption?.(option));
    try {
      if (result !== false)
        result = await handleValidation(address, option);
    } catch (e) {}
    return result ?? true;
  }, [onValidateOption]);

  return (
    <OptionsDialog
      title={`${isInsert ? 'Edit' : 'Insert'} Link`}
      options={options}
      onDone={onDone}
      onOption={(option: string) => handleHyperlink(option) }
      onValidateOption={handleValidateAddress}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      sx={{
        width: '480px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0), // helper text spacing is already applied
          rowGap: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
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
          label="Address"
          placeholder={'Enter a url or cell reference.'}
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
              shrink: true,
            },
            htmlInput: {
              className: 'autoFocus',
              spellCheck: false,
              autoComplete: "off",
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1.25),
                paddingBottom: (theme: Theme) => theme.spacing(0.75),
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
              }
            }
          }}
          value={address}
          onChange={handleOnAddressChange}
          // onKeyDown={handleKeyDown}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>
        <FormControl
          sx={{
            paddingTop: (theme: Theme) => theme.spacing(1.5),
            minWidth: 135, // TODO - make this dynamic
            width: '100%'
          }}
          size="small"
        >
        <TextField
          label="Display Text"
          placeholder={address?.startsWith('#') ? address.substring(1) : address}
          onFocus={() => {
            // if (!firstFocus) {
            //   e.target?.select();
            // }
            setFirstFocus(true);
          }}
          sx={{
            '& .MuiFormHelperText-root': {
              marginTop: (theme: Theme) => theme.spacing(0.5)
            }
          }}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              // className: 'autoFocus',
              spellCheck: false,
              autoComplete: "off",
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1.25),
                paddingBottom: (theme: Theme) => theme.spacing(0.75),
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
              }
            }
          }}
          value={displayText}
          onChange={handleOnDisplayChange}
          // onKeyDown={handleKeyDown}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>
      </Box>
    </OptionsDialog>
  );
});

export default HyperlinkDialog;
