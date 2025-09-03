import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextSubscriptIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 5.88,18 h 2.66 l 3.4,-5.42 h 0.12 l 3.4,5.42 h 2.66 L 13.47,10.73 17.81,4 H 15.13 L 12.06,8.99 H 11.94 L 8.85,4 H 6.19 l 4.32,6.73 z"
      />
      <path
        className="styled info"
        d="m 22,18 h -2 v 1 h 3 v 1 h -4 v -2 c 0,-0.55 0.45,-1 1,-1 h 2 v -1 h -3 v -1 h 3 c 0.55,0 1,0.45 1,1 v 1 c 0,0.55 -0.45,1 -1,1 z"
      />
    </SvgIcon>
  );
}

export default TextSubscriptIcon;