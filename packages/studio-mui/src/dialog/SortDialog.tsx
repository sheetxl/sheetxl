import React, { memo, useState } from 'react';

import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { IRange, ISort, Sort } from '@sheetxl/sdk';

import { useCallbackRef } from '@sheetxl/utils-react';

import type { CommandContext } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

export interface SortDialogProps extends InputDialogProps<ISort.RangeOptions, CommandContext.SelectedRange> {};


export const SortDialog = memo<SortDialogProps>((props: SortDialogProps) => {
  const {
    initialValue: sortOptions,
    context,
    onInput,
    onDone: propOnDone,
    ...rest
  } = props;


  const range = context?.().range;
  const cellAddress = context?.().cell.toString();;

  const [options, setOptions] = useState<ISort.RangeOptions>(sortOptions ?? Sort.DefaultRangeOptions);

  const handleDone = useCallbackRef((option: string) => {
    let updatedSortOptions = null;
    if (option === 'Sort') {
      updatedSortOptions = {
        ...sortOptions,
        ...options,
      }
    }
    onInput?.(updatedSortOptions);
    propOnDone?.(updatedSortOptions);
  }, [options, propOnDone, onInput, sortOptions]);

  return (
    <OptionsDialog
      title={'Sort'}
      options={['Sort', 'Cancel']}
      onDone={handleDone}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={!options.reverse}
              onChange={() => setOptions((prev: ISort.RangeOptions) => {
                return {
                  ...prev,
                  reverse: !prev.reverse
                }
              })}
            />
          }
          label="Is Ascending"
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={options.hasHeader}
              onChange={() => setOptions((prev: ISort.RangeOptions) => {
                return {
                  ...prev,
                  hasHeader: !prev.hasHeader
                }
              })}
            />
          }
          label="Has Header"
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              // TODO - indeterminate?
              checked={(options.collatorOptions as any)?.sensitivity === Sort.CaseSensitiveOptions.sensitivity}
              onChange={() => setOptions((prev: ISort.RangeOptions) => {
                const isCaseSensitive = (options.collatorOptions as any)?.sensitivity === Sort.CaseSensitiveOptions.sensitivity;
                return {
                  ...prev,
                  collatorOptions: isCaseSensitive ? Sort.CaseInsensitiveOptions : Sort.CaseSensitiveOptions
                }
              })}
            />
          }
          label="Case Sensitive"
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={options.orientation === IRange.Orientation.Row}
              onChange={() => setOptions((prev: ISort.RangeOptions) => {
                const newOrientation = prev.orientation === IRange.Orientation.Row ? IRange.Orientation.Column : IRange.Orientation.Row;
                const newDefaultOptions:ISort.RangeOptions = range.getDefaultSortCriteria(newOrientation, cellAddress).options;
                return {
                  ...newDefaultOptions,
                  includeHidden: prev.includeHidden,
                  reverse: prev.reverse,
                  orientation: newOrientation,
                }
              })}
            />
          }
          label="Row Sort"
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={options.includeHidden}
              onChange={() => setOptions((prev: ISort.RangeOptions) => {
                return {
                  ...prev,
                  includeHidden: !prev.includeHidden
                }
              })}
            />
          }
          label="Include Hidden"
          labelPlacement="end"
        />
      </Box>
    </OptionsDialog>
  );
});

export default SortDialog;
