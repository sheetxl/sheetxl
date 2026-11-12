import { memo } from 'react';

import { ToggleButton, ToggleButtonGroup } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

export interface BooleanOptionProps {
  /**
   * The current boolean value. Defaults to `true` when null/undefined.
   */
  option: boolean | null;
  /**
   * Called when the value changes.
   */
  onOptionChange: (option: boolean) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Compact True / False toggle for boolean condition params.
 *
 * @remarks
 * Renders two exclusive toggle buttons labelled "True" and "False".
 * This matches the convention used by Excel / Google Sheets data validation
 * for boolean (logical) values.
 */
export const BooleanOption = memo<BooleanOptionProps>((props) => {
  const { option, onOptionChange, readOnly } = props;

  const t = useTranslator();
  const value = option ?? true;

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, newValue) => {
        // ToggleButtonGroup fires null when the active button is clicked again — ignore
        if (newValue === null) return;
        onOptionChange(newValue as boolean);
      }}
      sx={{ my: 0, py: 0, backgroundColor: 'background.paper' }}
      disabled={readOnly}
    >
      <ToggleButton value={true}>{t('condition.true')}</ToggleButton>
      <ToggleButton value={false}>{t('condition.false')}</ToggleButton>
    </ToggleButtonGroup>
  );
});

BooleanOption.displayName = 'BooleanOption';
