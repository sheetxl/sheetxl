import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotation315Icon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 4.49,4.21 3.43,5.27 7.85,16.4 9.33,14.92 8.41,12.73 l 3.54,-3.54 2.19,0.92 1.48,-1.48 z m 3.09,6.8 -2.22,-4.87 4.87,2.23 z"
      />
      <path
        className="styled info"
        d="m 20.57,9.33 h -4.24 l 1.41,1.41 -8.84,8.84 1.42,1.42 8.84,-8.84 1.41,1.41 z"
      />
    </SvgIcon>
  );
}

export default TextRotation315Icon;