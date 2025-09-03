import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotation0Icon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 12.75,3 h -1.5 L 6.5,14 h 2.1 l 0.9,-2.2 h 5 l 0.9,2.2 h 2.1 z M 10.13,10 12,4.98 13.87,10 Z"
      />
      <path
        className="styled info"
        d="m 20.5,18 -3,-3 v 2 H 5 v 2 h 12.5 v 2 z"
      />
    </SvgIcon>
  );
}

export default TextRotation0Icon;