import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextVerticalTopIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 4,3 V 5 H 20 V 3 Z"
      />
      <path
        className="styled info"
        d="m 8,11 h 3 v 10 h 2 V 11 h 3 L 12,7 Z"
      />
    </SvgIcon>
  );
}

export default TextVerticalTopIcon;