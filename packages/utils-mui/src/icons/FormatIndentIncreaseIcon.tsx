import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const FormatIndentIncreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 3,21 H 21 V 19 H 3 Z M 3,3 V 5 H 21 V 3 Z m 8,6 H 21 V 7 H 11 Z m 0,4 H 21 V 11 H 11 Z m 0,4 H 21 V 15 H 11 Z"
      />
      <path
        className="styled info"
        d="M 7,12 3,8 v 8 z"
      />
    </SvgIcon>
  );
}

export default FormatIndentIncreaseIcon;