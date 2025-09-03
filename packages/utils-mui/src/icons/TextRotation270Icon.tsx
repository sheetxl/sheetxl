import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotation270Icon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 3,12 v 1.5 l 11,4.75 v -2.1 l -2.2,-0.9 v -5 L 14,9.35 V 7.25 Z M 10,14.62 4.98,12.75 10,10.88 Z"
      />
      <path
        className="styled info"
        d="m 18,4.25 -3,3 h 2 v 12.5 h 2 V 7.25 h 2 z"
      />
    </SvgIcon>
  );
}

export default TextRotation270Icon;