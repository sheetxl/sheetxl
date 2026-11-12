import React, { memo } from 'react';

import clsx from 'clsx';

import {
  Box, FormControl, Select, MenuItem, TextField, type BoxProps, type SxProps, type Theme
} from '@mui/material';

import { ICondition } from '@sheetxl/sdk';
import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import styles from './Conditions.module.css';

export interface AverageOptionProps extends BoxProps {
  /**
   * The average option to edit.
   */
  option: ICondition.AverageOption;

  /**
   * The callback function to handle changes in the average option.
   */
  onOptionChange: (option: ICondition.AverageOption) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Component for editing average option (above/below average with optional standard deviations).
 *
 * @remarks
 * Allows filtering values above or below average, with optional standard deviation offset.
 */
export const AverageOption = memo<AverageOptionProps>((props) => {
  const {
    option,
    onOptionChange,
    className: propClassName,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const operator = option?.type ?? ICondition.AverageType.Above;
  const stdDevs = option?.stdDevs ?? '';
  let selectSx: SxProps<Theme> = {
    backgroundColor: 'background.paper'
  }
  if (readOnly) {
    selectSx = {
      ...selectSx,
      '& .MuiSelect-icon': {
        display: 'none' // Hide dropdown arrow when readonly
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'action.disabled' // Subtle visual cue
      },
    }
  }
  return (
    <Box
      className={clsx(propClassName, styles['option'])}
      {...rest}
      sx={{
        display: 'flex', flexDirection: 'row', gap: 0.25, ...rest?.sx
      }}
    >
      {/* Type Dropdown */}
      <FormControl sx={{ flex: 0.5 }} size="small">
        <Select
          value={operator}
          sx={selectSx}
          IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
          disabled={readOnly}
          onChange={(e) => onOptionChange({
            ...option,
            type: e.target.value as ICondition.AverageType
          })}
        >
          <MenuItem value={ICondition.AverageType.Above}>{t('condition.above')}</MenuItem>
          <MenuItem value={ICondition.AverageType.Below}>{t('condition.below')}</MenuItem>
        </Select>
      </FormControl>

      {/* Standard Deviations */}
      <TextField
        size="small"
        // label="Standard deviations (optional)"
        placeholder={t('condition.stdDevs')}
        value={stdDevs}
        onChange={(e) => {
          const value = Number(e.target.value) || '';
          const newOption = { ...option };
          if (typeof value === 'number') {
            newOption.stdDevs = value;
          } else {
            delete newOption.stdDevs;
          }
          onOptionChange(newOption);
        }}
        sx={{ flex: 0.5 }}
        disabled={readOnly}
        slotProps={{
          input: {
            sx: { backgroundColor: 'background.paper' }
          }
        }}
        type="number"
        // helperText="Optional: Standard deviation"
      />
    </Box>
  );
});

AverageOption.displayName = 'AverageOption';
