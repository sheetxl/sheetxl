import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextHorizontalClipIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 4,3 V 21 H 2 V 3 Z m 18,5.573e-4 V 21.000557 H 20 V 3.0005573 Z"
      />
      <path
        className="styled info"
        d="m 8,10.715958 v 2.57 h 12 v -2.57 z"
      />
    </SvgIcon>
  );
}

export default TextHorizontalClipIcon;