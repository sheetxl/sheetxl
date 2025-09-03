import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

import { strokeShadowFilter } from '../theme/ThemedIcon';

export const ColorizedStrokeIcon = (props: SvgIconProps) => {
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
      <path d="m 17.28,7.18 -3.75,-3.75 -10,10 v 3.75 h 3.75 z m 2.96,-2.96 c 0.39,-0.39 0.39,-1.02 0,-1.41 l -2.34,-2.34 c -0.39,-0.39 -1.02,-0.39 -1.41,0 l -1.96,1.96 3.75,3.75 z" fillOpacity="1"></path>
      <path className="activeColor" d="M0 20h24v4H0z" fillOpacity="1" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5"></path>
    </SvgIcon>
  );
}

export default ColorizedStrokeIcon;