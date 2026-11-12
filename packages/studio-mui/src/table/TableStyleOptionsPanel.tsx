import type React from 'react';
import {
  memo, forwardRef
} from 'react';

import clsx from 'clsx';

import { type SxProps } from '@mui/system';
import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { type ITableStyle } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import styles from './TableStyleOptionsPanel.module.css';

// import { useImperativeElement } from '@sheetxl/utils-react';

/**
 * This is a panel that is used to configure options for a table.
 */
export interface TableStyleOptionsPanelProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  styleOptions: ITableStyle.StyleOptions;

  showHeaderRow?: boolean;

  showTotalRow?: boolean;

  showButton?: boolean;

  onStyleOptionsChange?: (options: ITableStyle.StyleOptions) => void;

  onShowHeaderRowChange?: (showHeaderRow: boolean) => void;

  onShowTotalRowChange?: (showTotalRow: boolean) => void;

  onShowButtonChange?: (showButton: boolean) => void;

  disabled?: boolean;
}

export interface TableStyleOptionsAttributes {
  // None yet
}
/**
 * Type returned via ref property
 */
export interface TableStyleOptionsElement extends TableStyleOptionsAttributes, HTMLElement {};

export type TableStyleOptionsAttribute = {
  ref?: React.Ref<TableStyleOptionsElement>;
};

/**
 * Shows options with tables.
 * TODO - We will later also have the options as commands.
 */
export const TableStyleOptionsPanel = memo(
  forwardRef<TableStyleOptionsElement, TableStyleOptionsPanelProps>((props, refForwarded) => {
  const {
    styleOptions,
    onStyleOptionsChange,
    showHeaderRow,
    onShowHeaderRowChange,
    showTotalRow,
    onShowTotalRowChange,
    showButton,
    onShowButtonChange,
    sx: propSX,
    className: propClassName,
    disabled,
    ...rest
  } = props;

  // const refLocal = useImperativeElement<TableStyleOptionsElement, TableStyleOptionsAttributes>(refForwarded, () => ({
  // }), []);

  const t = useTranslator();

  return (
    <div
      className={styles['table-style-options-container']}
    >
      <Box
        sx={{
          pt: 1,
          pb: 1,
          '& .MuiFormControlLabel-root': {
            marginLeft: (theme: Theme) => {
              return `${theme.spacing(2)}`;
            },
            marginRight: (theme: Theme) => {
              return `${theme.spacing(2)}`;
            }
          },
          '& .MuiCheckbox-root': {
            padding : (theme: Theme) => {
              return `${theme.spacing(0.5)}`;
            }
          },
          ...propSX
        }}
        {...rest}
        ref={refForwarded}
        className={clsx(propClassName, styles['table-style-options'])}
      >
        { onShowHeaderRowChange && (
        <FormControlLabel
          control={
            <Checkbox
              checked={showHeaderRow ?? false}
              indeterminate={showHeaderRow === null || showHeaderRow === undefined}
              onChange={() => onShowHeaderRowChange(!showHeaderRow)}
              disabled={disabled || showHeaderRow === null || showHeaderRow === undefined}
            />
          }
          label={t('tableStyle.headerRow')}
          labelPlacement="end"
        />
        )}
        { onShowTotalRowChange && (
        <FormControlLabel
          control={
            <Checkbox
              checked={showTotalRow ?? false}
              indeterminate={showTotalRow === null || showTotalRow === undefined}
              onChange={() => onShowTotalRowChange(!showTotalRow)}
              disabled={disabled || showTotalRow === null || showTotalRow === undefined}
            />
          }
          label={t('tableStyle.totalRow')}
          labelPlacement="end"
        />
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={styleOptions?.showRowStripes ?? false}
              indeterminate={!styleOptions}
              disabled={disabled || !styleOptions}
              onChange={() => {
                onStyleOptionsChange?.({
                  ...styleOptions,
                  showRowStripes: !styleOptions?.showRowStripes
                });
              }}
            />
          }
          label={t('tableStyle.bandedRows')}
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={styleOptions?.showFirstColumn ?? false}
              indeterminate={!styleOptions}
              disabled={disabled || !styleOptions}
              onChange={() => {
                onStyleOptionsChange?.({
                  ...styleOptions,
                  showFirstColumn: !styleOptions?.showFirstColumn
                });
              }}
            />
          }
          label={t('tableStyle.firstColumn')}
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={styleOptions?.showLastColumn ?? false}
              indeterminate={!styleOptions}
              disabled={disabled || !styleOptions}
              onChange={() => {
                onStyleOptionsChange?.({
                  ...styleOptions,
                  showLastColumn: !styleOptions?.showLastColumn
                });
              }}
            />
          }
          label={t('tableStyle.lastColumn')}
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={styleOptions?.showColumnStripes ?? false}
              indeterminate={!styleOptions}
              disabled={disabled || !styleOptions}
              onChange={() => {
                onStyleOptionsChange?.({
                  ...styleOptions,
                  showColumnStripes: !styleOptions?.showColumnStripes
                });
              }}
            />
          }
          label={t('tableStyle.bandedColumns')}
          labelPlacement="end"
        />
        { onShowButtonChange && (
        <FormControlLabel
          control={
            <Checkbox
              checked={showButton ?? false}
              indeterminate={showButton === null || showButton === undefined}
              disabled={disabled || !styleOptions || showButton === null || showButton === undefined}
              onChange={() => onShowButtonChange(!showButton)}
            />
          }
          label={t('tableStyle.filterButton')} // Column Button
          labelPlacement="end"
        />
        )}
      </Box>
    </div>
  );
}));
