import React, { useState, memo, useEffect } from 'react';

import { TextField, TextFieldProps } from '@mui/material';

import { KeyCodes } from '@sheetxl/utils-react';

/**
 * Simple component that delays firing onChange until enter or blur.
 */
export const RelaxedChangeTextField = memo((props: TextFieldProps) => {
  const {
    value : propValue,
    onChange: propOnChange,
    onKeyDown: propOnKeyDown,
    onBlur: propOnBlur,
    ...rest
  } = props;

  const [lastChangeEvent, setLastChangeEvent] = useState<React.ChangeEvent<HTMLInputElement>>(null);
  useEffect(() => {
    setLastChangeEvent(null);
  }, [propValue]);

  return (
    <TextField
      {...rest}
      value={lastChangeEvent?.target.value ?? propValue ?? ''}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.which === KeyCodes.Enter && lastChangeEvent) {
          setLastChangeEvent(null);
          propOnChange?.(lastChangeEvent);
          propOnKeyDown?.(event);
        }
      }}
      onBlur={(event) => {
        setLastChangeEvent(null);
        propOnChange?.(event);
        propOnBlur?.(event);
      }}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        setLastChangeEvent(event);
      }}
    />
  );
});