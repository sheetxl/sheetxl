import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderHorizontalIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 3,21 H 5 V 19 H 3 Z M 5,7 H 3 V 9 H 5 Z M 3,17 H 5 V 15 H 3 Z m 4,4 H 9 V 19 H 7 Z M 5,3 H 3 V 5 H 5 Z M 9,3 H 7 v 2 h 2 z m 8,0 h -2 v 2 h 2 z m -4,4 h -2 v 2 h 2 z m 0,-4 h -2 v 2 h 2 z m 6,14 h 2 v -2 h -2 z m -8,4 h 2 V 19 H 11 Z M 19,3 v 2 h 2 V 3 Z m 0,6 h 2 V 7 h -2 z m -8,8 h 2 v -2 h -2 z m 4,4 h 2 v -2 h -2 z m 4,0 h 2 v -2 h -2 z"
      />
      <path
        className="styled activeColor"
        d="M 3,13 H 21 V 11 H 3 Z"
      />
    </SvgIcon>
  );
}

export default BorderHorizontalIcon;