import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextVerticalCenterIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 4,11 v 2 h 16 v -2 z"
      />
      <path
        className="styled info"
        d="m 8,19 h 3 v 4 h 2 v -4 h 3 L 12,15 Z M 16,5 H 13 V 1 H 11 V 5 H 8 l 4,4 z"
      />
    </SvgIcon>
  );
}

export default TextVerticalCenterIcon;