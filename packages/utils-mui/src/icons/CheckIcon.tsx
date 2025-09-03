import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const CheckIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        className="styled info"
        d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
      />
    </SvgIcon>
  );
}

export default CheckIcon;