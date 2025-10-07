import React, { useState, memo, useCallback } from 'react';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { ICellRanges } from '@sheetxl/sdk';
import { useCallbackRef } from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';

import { OptionsDialog, InputDialogProps } from '@sheetxl/utils-mui';

import { RangeInput } from '../components';

export interface TableNewDialogProps extends InputDialogProps<CommandContext.NewTable, CommandContext.Table> {};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * TODO - get cancel to actually work
 * TODO - get range to actually work
 * TODO - default has header
 * TODO - spacing is poor
 */
export const TableNewDialog = memo<TableNewDialogProps>((props: TableNewDialogProps) => {
  const {
    onInput,
    onOption,
    onValidateOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    initialValue,
    context,
    ...rest
  } = props;


  // const context = initialTableOptions?.context;

  const [firstFocus, setFirstFocus] = useState<boolean>(false);
  const [hasHeader, setHasHeader] = useState<boolean>(() => initialValue?.hasHeader ?? false);
  const [ranges, setRanges] = useState<ICellRanges>(() => initialValue?.ranges ?? null);

  const handleDone = useCallbackRef((option) => {
    const tableOptions:CommandContext.NewTable = {
      ...initialValue,
      hasHeader,
      ranges
    }

    const isCancel = option === cancelOption;
    if (!isCancel) {
      onInput?.(tableOptions);
    }
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.({
      option,
      tableOptions
    });
  }, [onDone, onOption, defaultOption, cancelOption, hasHeader, ranges, initialValue]);

  const handleValidation = useCallback(async (_input?: string, _option?: string): Promise<boolean> => {
    // TODO - Border Color (and perhaps tooltip on invalid)
    // return TextUtils.isValidHttpUrl(input);
    return null;
  }, []);

  // const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (e.keyCode === KeyCodes.Enter) {
  //       // let valid = await handleValidation(input, null);
  //       // if (valid !== false)
  //     // handleDone(defaultOption);
  //   }
  // }, []);

  return (
    <OptionsDialog
      title={`Insert Table`}
      options={options}
      onDone={handleDone}
      // onOption={(option: string) => handleDone(option) }
      onValidateOption={handleValidation}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.range-input input'}
      sx={{
        width: '360px',
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
        <RangeInput
          formName={'range'}
          value={ranges}
          onChangeInput={(value: ICellRanges) => setRanges(value)}
          // TODO - valid resize
          resolvedAddress={context ? context().getNames().getRanges.bind(context().getNames()) : undefined}
          // onKeyDown={handleKeyDown}
          // disabled={table?.isProtected() ?? true}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            if (!firstFocus) {
              e.target?.select();
            }
            setFirstFocus(true);
          }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={hasHeader}
              onChange={() => setHasHeader(!hasHeader)}
            />
          }
          label="Table has headers"
          labelPlacement="end"
        />
      </Box>
    </OptionsDialog>
  );
});

export default TableNewDialog;
