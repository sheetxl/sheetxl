import React, {
  useEffect, useMemo, useState, memo, useCallback
} from 'react';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';
import { Select, SelectChangeEvent } from '@mui/material';

import { ICell, NumberFormat } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

import { OptionsDialog, OptionsDialogProps } from '@sheetxl/utils-mui';


export interface NumberFormatDialogProps extends OptionsDialogProps {
  initialValue?: string;

  context: () => ICell;

  onInputOption?: (input?: string, option?: string) => void;
};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];
export const NumberFormatDialog: React.FC<NumberFormatDialogProps> = memo((props) => {
  const {
    initialValue,
    context,
    onOption,
    onValidateOption,
    onInputOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const [input, setInput] = useState<string>(initialValue);
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const onValidateInputOption = useCallback(async (_input?: string, _option?: string): Promise<boolean> => {
    // TODO - do validation of format
    return true;
  }, []);

  const handleInput = useCallbackRef(async (option: string) => {
    onInputOption?.(input, option);
    onOption?.(option, option === cancelOption, option === defaultOption);
    onDone?.();
  }, [input, onInputOption, onDone, onOption, cancelOption, defaultOption]);

  const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === KeyCodes.Enter) {
      let valid = await onValidateInputOption?.(input, null);
      if (valid !== false)
        handleInput(defaultOption);
    }
  }, [input, handleInput]);

  const handleOnChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onValidateInputOption?.(e.target.value, null);
  }, [onValidateOption]);

  const handleValidateOption = useCallbackRef(async (option: string): Promise<boolean> => {
    let result = await Promise.resolve(onValidateOption?.(option));
    try {
      if (result !== false)
        result = await Promise.resolve(onValidateInputOption?.(input, option)) ?? true;
    } catch (e) {}
    return result ?? true;
  }, [onValidateOption]);

  const [formatCategory, setFormatCategory] = useState<string>(NumberFormat.Styles.lookupStyle(input).formatType ?? NumberFormat.Type.Custom);
  useEffect(() => {
    setFormatCategory(NumberFormat.Styles.lookupStyle(input).formatType ?? NumberFormat.Type.Custom);
  }, [input])

  const categoryOptions = useMemo(() => {
    const formats = NumberFormat.Styles.lookupPrimary();
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
    const options =  Object.keys(formats).map((key) => {
      return createOption(formats[key].formatType);
    });
    options.push(createOption(NumberFormat.Type.Custom));
    return options;
  }, []);

  const handleCategoryChange = useCallback((event: SelectChangeEvent<string>) => {
    const category:string = event.target.value;
    setFormatCategory(category);
    const formatCode = NumberFormat.Styles.lookupDefault(category);
    if (formatCode)
      setInput(formatCode);
  }, []);

  const previewCell = useMemo(() => {
    const contextValue:ICell = context();
    const retValue = contextValue.createTemporaryCell({
      value: contextValue.getValue() ?? 12345,
      style: {
        numberFormat: input
      }
    });
    return retValue;
  }, [formatCategory, input, context]);

  return (
    <OptionsDialog
      title="Number Format"
      options={options}
      onDone={onDone}
      onOption={(option: string) => handleInput(option) }
      onValidateOption={handleValidateOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      sx={{
        width: '580px',
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
            minWidth: 135 // TODO - make this dynamic
          }}
          size="small"
        >
          <InputLabel>
            {'Category'}
          </InputLabel>
          <Select
            value={formatCategory}
            label={"Category"}
            onChange={handleCategoryChange}
            sx={{
              backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
            }}
          >
            {categoryOptions}
          </Select>
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
          label="Code"
          onFocus={(e) => {
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
          InputLabelProps={{
            shrink: true
          }}
          InputProps={{
            inputProps: {
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

          value={input}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>
        <Box>
          <Typography
            variant="caption"
            component='div'
            sx={{
              paddingLeft: (theme: Theme) => theme.spacing(2)
            }}
          >
            Preview
          </Typography>

          <Typography
            variant="body2"
            component='div'
            sx={{
              borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,//theme.shape.borderRadius,
              padding: (theme: Theme) => theme.spacing(1),
              border: (theme: Theme) => `1px solid ${theme.palette.grey[400]}`,
            }}
          >
            {previewCell.getNumberFormat().displayText || '(empty)'}
          </Typography>
        </Box>
      </Box>
    </OptionsDialog>
  );
});

export default NumberFormatDialog;
