import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderInnerIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 7,21 H 9 V 19 H 7 Z M 5,7 H 3 V 9 H 5 Z M 3,17 H 5 V 15 H 3 Z M 9,3 H 7 V 5 H 9 Z M 5,3 H 3 v 2 h 2 z m 12,0 h -2 v 2 h 2 z m 2,6 h 2 V 7 h -2 z m 0,-6 v 2 h 2 V 3 Z m -4,18 h 2 v -2 h -2 z m 4,0 h 2 v -2 h -2 z m 0,-4 h 2 V 15 H 19 Z M 3,21 H 5 V 19 H 3 Z"
      />
      <path
        className="styled activeColor"
        d="m 13,3 h -2 v 8 H 3 v 2 h 8 v 8 h 2 v -8 h 8 v -2 h -8 z"
      />
    </SvgIcon>
  );
}

export default BorderInnerIcon;