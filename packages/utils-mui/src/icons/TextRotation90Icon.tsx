import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotation90Icon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 21,12 V 10.5 L 10,5.75 v 2.1 l 2.2,0.9 v 5 l -2.2,0.9 v 2.1 z M 14,9.38 19.02,11.25 14,13.12 Z"
      />
      <path
        className="styled info"
        d="m 6,19.75 3,-3 H 7 V 4.25 H 5 v 12.5 H 3 Z"
      />
    </SvgIcon>
  );
}

export default TextRotation90Icon;