import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextVerticalBottomIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 4,19 v 2 h 16 v -2 z"
      />
      <path
        className="styled info"
        d="M 16,13 H 13 V 3 H 11 V 13 H 8 l 4,4 z"
      />
    </SvgIcon>
  );
}

export default TextVerticalBottomIcon;