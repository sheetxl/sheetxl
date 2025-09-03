import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotation45Icon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 19.4,4.91 18.34,3.85 7.2,8.27 l 1.48,1.48 2.19,-0.92 3.54,3.54 -0.92,2.19 1.48,1.48 z m -6.81,3.1 4.87,-2.23 -2.23,4.87 z"
      />
      <path
        className="styled info"
        d="M 14.27,21 V 16.76 L 12.86,18.17 4.02,9.33 2.6,10.75 11.44,19.59 10.03,21 Z"
      />
    </SvgIcon>
  );
}

export default TextRotation45Icon;