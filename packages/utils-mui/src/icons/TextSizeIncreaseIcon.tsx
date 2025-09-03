import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextSizeIncreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 6.4082031,5.2265625 H 8.5917969 L 13.681641,18.773437 H 11.751953 L 10.490234,15.193359 H 4.5195312 L 3.25,18.773437 H 1.3183594 Z M 7.2792969,7.3730469 5.0898437,13.617188 H 9.9101563 L 7.7207031,7.3730469 Z"
      />
      <path
        className="styled info"
        d="m 20,11 h 3 v 2 h -3 v 3 h -2 v -3 h -3 v -2 h 3 V 8 h 2 z"
      />
    </SvgIcon>
  );
}

export default TextSizeIncreaseIcon;