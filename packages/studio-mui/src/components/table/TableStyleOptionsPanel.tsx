import React, {
  memo, forwardRef
} from 'react';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { ITableStyle } from '@sheetxl/sdk';

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

  showFilterButton?: boolean;

  onStyleOptionsChange?: (options: ITableStyle.StyleOptions) => void;

  onShowHeaderRowChange?: (showHeaderRow: boolean) => void;

  onShowTotalRowChange?: (showTotalRow: boolean) => void;

  onShowFilterButtonChange?: (showFilterButton: boolean) => void;

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
export const TableStyleOptionsPanel: React.FC<TableStyleOptionsPanelProps & TableStyleOptionsAttribute> = memo(
  forwardRef<TableStyleOptionsElement, TableStyleOptionsPanelProps>((props, refForwarded) => {
  const {
    styleOptions,
    onStyleOptionsChange,
    showHeaderRow,
    onShowHeaderRowChange,
    showTotalRow,
    onShowTotalRowChange,
    showFilterButton,
    onShowFilterButtonChange,
    sx: propSX,
    disabled,
    ...rest
  } = props;

  // const refLocal = useImperativeElement<TableStyleOptionsElement, TableStyleOptionsAttributes>(refForwarded, () => ({
  // }), []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'wrap',
        userSelect: 'none',
        pt: 1,
        pb: 1,
        // rowGap: (theme: Theme) => {
        //   return `${theme.spacing(0.5)}`;
        // },
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
      // ref={refLocal}
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
        label="Header Row"
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
        label="Total Row"
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
        label="Banded Rows"
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
        label="First Column"
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
        label="Last Column"
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
        label="Banded Columns"
        labelPlacement="end"
      />
      { onShowFilterButtonChange && (
      <FormControlLabel
        control={
          <Checkbox
            checked={showFilterButton ?? false}
            indeterminate={showFilterButton === null || showFilterButton === undefined}
            disabled={disabled || !styleOptions || showFilterButton === null || showFilterButton === undefined}
            onChange={() => onShowFilterButtonChange(!showFilterButton)}
          />
        }
        label="Filter Button"
        labelPlacement="end"
      />
      )}
    </Box>
  );
}));

export default TableStyleOptionsPanel;