import type React from 'react';
import { memo } from 'react';

import {
  Box, FormControl, Select, MenuItem, TextField, type BoxProps
} from '@mui/material';

import { type ICondition } from '@sheetxl/sdk';
import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

export interface TopNOptionProps extends BoxProps {
  /**
   * The top N option to edit.
   */
  option: ICondition.TopNOption;

  /**
   * The callback function to handle changes in the top N option.
   */
  onOptionChange: (option: ICondition.TopNOption) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Component for editing top N option (top/bottom N items/percent).
 *
 * @remarks
 * Allows selecting top or bottom N values, either by count or percentage.
 */
export const TopNOption = memo<TopNOptionProps>((props) => {
  const { option, onOptionChange, readOnly, ...rest } = props;

  const t = useTranslator();

  const top = option?.top ?? true;
  const limit = option?.limit ?? 10;
  const percent = option?.percent ?? false;

  return (
    <Box
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 0.25,
        ...rest?.sx
      }}
    >
      {/* Top/Bottom Selector */}
      <FormControl size="small" sx={{ flex: 1 }}>
        <Select
          value={top ? 'top' : 'bottom'}
          sx={{ backgroundColor: 'background.paper' }}
          IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
          onChange={(e) => onOptionChange({
            ...option,
            top: e.target.value === 'top'
          })}
          disabled={readOnly}
        >
          <MenuItem value="top">{t('condition.top')}</MenuItem>
          <MenuItem value="bottom">{t('condition.bottom')}</MenuItem>
        </Select>
      </FormControl>

      {/* Value Input */}
      <TextField
        size="small"
        // label="Value"
        placeholder="10"
        value={limit}
        onChange={(e) => {
          const value = parseFloat(e.target.value) || 10;
          onOptionChange({ ...option, limit: value });
        }}
        disabled={readOnly}
        type="number"
        slotProps={{
          input: {
            sx: { backgroundColor: 'background.paper' }
          }
        }}
        sx={{ flex: 0.6 }}
      />

      {/* Items/Percent Selector */}
      <FormControl size="small" sx={{ flex: 1 }}>
        <Select
          value={percent ? 'percent' : 'items'}
          sx={{ backgroundColor: 'background.paper' }}
          IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
          onChange={(e) => onOptionChange({
            ...option,
            percent: e.target.value === 'percent'
          })}
          disabled={readOnly}
        >
          <MenuItem value="items">{t('condition.items')}</MenuItem>
          <MenuItem value="percent">{t('condition.percent')}</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
});

TopNOption.displayName = 'TopNOption';
