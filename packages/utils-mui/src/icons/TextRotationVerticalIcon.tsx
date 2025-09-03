import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextRotationVerticalIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 15.75,5 h -1.5 L 9.5,16 h 2.1 l 0.9,-2.2 h 5 l 0.9,2.2 h 2.1 z M 13.13,12 15,6.98 16.87,12 Z"
      />
      <path
        className="styled info"
        d="m 6,19.75 3,-3 H 7 V 4.25 H 5 v 12.5 H 3 Z"
      />
    </SvgIcon>
  );
}

export default TextRotationVerticalIcon;