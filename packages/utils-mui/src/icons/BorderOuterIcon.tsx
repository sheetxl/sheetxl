import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderOuterIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 13,7 h -2 v 2 h 2 z m 0,4 h -2 v 2 h 2 z m 4,0 h -2 v 2 h 2 z m -4,4 h -2 v 2 h 2 z M 9,11 H 7 v 2 h 2 z"
      />
      <path
        className="styled activeColor"
        d="M 3,3 V 21 H 21 V 3 Z M 19,19 H 5 V 5 h 14 z"
      />
    </SvgIcon>
  );
}

export default BorderOuterIcon;