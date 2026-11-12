import { memo } from 'react';

import { TextField, type TextFieldProps } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

export interface StringOptionProps extends Omit<TextFieldProps, 'onChange'> {
  /**
   * The option to edit.
   */
  option: string;
  /**
   * The callback function to handle changes in the option.
   */
  onOptionChange: (option: string) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Component for editing a text field option.
 *
 * @remarks
 * Simple text editor for custom validation.
 * Text is evaluated relative to the cell being validated.
 */
export const StringOption = memo<StringOptionProps>((props) => {
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
      type="text"
      placeholder={t('condition.enterText')}
      value={option ?? ''}
      onChange={(e) => onOptionChange(String(e.target.value))}
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

StringOption.displayName = 'StringOption';