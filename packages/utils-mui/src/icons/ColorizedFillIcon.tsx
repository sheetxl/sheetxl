import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

import { strokeShadowFilter } from '../theme/ThemedIcon';

export const ColorizedFillIcon = (props: SvgIconProps) => {
  const {
    sx: propSx,
    ...rest
  } = props;
  return (
    <SvgIcon
      sx={{
        overflow: 'visible',
        '& .activeColor': {
          filter: strokeShadowFilter,
        },
        ...propSx,
      }}
      {...rest}
    >
      <path className="activeColor" d="M10 5.21L5.21 10h9.58z" fillOpacity="1"></path>
      <path d="M19 17c1.1 0 2-.9 2-2 0-1.33-2-3.5-2-3.5s-2 2.17-2 3.5c0 1.1.9 2 2 2zm-10.06-.44c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5zM10 5.21L14.79 10H5.21L10 5.21z" fillOpacity="1"></path>
      <path className="activeColor" d="M0 20h24v4H0z" fill="blue" fillOpacity="1" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5"></path>
    </SvgIcon>
  );
};

export default ColorizedFillIcon;