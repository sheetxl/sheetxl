import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const FullScreenOffIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M14 14h5v2h-3v3h-2v-5zM5 14h5v5h-2v-3h-3v-2zM8 5h2v5h-5v-2h3v-3zM19 8v2h-5v-5h2v3h3z"
      />
    </SvgIcon>
  );
}

export default FullScreenOffIcon;