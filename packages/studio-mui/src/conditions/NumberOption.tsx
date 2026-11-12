import { memo } from 'react';

import { TextField, type TextFieldProps } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

export interface NumberOptionProps extends Omit<TextFieldProps, 'onChange'> {
  /**
   * The option to edit.
   */
  option: number;
  /**
   * The callback function to handle changes in the option.
   */
  onOptionChange: (option: number) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Component for editing a number option.
 *
 * @remarks
 * Simple number editor for custom validation.
 * Numbers are evaluated relative to the cell being validated.
 */
export const NumberOption = memo<NumberOptionProps>((props) => {
  const {
    option,
    onOptionChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();

  return (
    <TextField
      size="small"
      type="number"
      placeholder={t('condition.enterNumber')}
      value={'' + (option ?? '')}
      onChange={(e) => onOptionChange(Number(e.target.value))}
      disabled={readOnly}
      {...rest}
      slotProps={{
        input: {
          sx: { backgroundColor: 'background.paper' }
        }
      }}
    />
  );
});

NumberOption.displayName = 'NumberOption';