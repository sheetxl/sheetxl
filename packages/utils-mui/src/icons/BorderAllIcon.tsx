import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderAllIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        className="styled activeColor"
        d="M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z"
      />
    </SvgIcon>
  );
}

export default BorderAllIcon;