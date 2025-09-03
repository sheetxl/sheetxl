import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

import { strokeShadowFilter } from '../theme/ThemedIcon';

export const ColorizedCircleIcon = (props: SvgIconProps) => {
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
      <path className="activeColor" opacity="1" d="M12 20c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8z"></path>
      <path className="style_grey" opacity=".3" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"></path>
      <path className="activeColor" opacity=".3" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"></path>
    </SvgIcon>
  );
};

export default ColorizedCircleIcon;