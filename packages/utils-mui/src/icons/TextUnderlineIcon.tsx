import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextUnderlineIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 12,17 c 3.31,0 6,-2.69 6,-6 V 3 h -2.5 v 8 c 0,1.93 -1.57,3.5 -3.5,3.5 -1.93,0 -3.5,-1.57 -3.5,-3.5 V 3 H 6 v 8 c 0,3.31 2.69,6 6,6 z"
      />
      <path
        className="styled info"
        d="m 5,19 v 2 h 14 v -2 z"
      />
    </SvgIcon>
  );
}

export default TextUnderlineIcon;