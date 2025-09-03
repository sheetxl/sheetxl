import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const FullScreenIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M5 5h5v2h-3v3h-2v-5zM14 5h5v5h-2v-3h-3v-2zM17 14h2v5h-5v-2h3v-3zM10 17v2h-5v-5h2v3h3z"
      />
    </SvgIcon>
  );
}

export default FullScreenIcon;