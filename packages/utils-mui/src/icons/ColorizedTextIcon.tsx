import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

import { strokeShadowFilter } from '../theme/ThemedIcon';

export const ColorizedTextIcon = (props: SvgIconProps) => {
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
      <path d="M 5.615,17.375 H 8.0566072 L 9.3379465,13.763035 H 15.038393 L 16.309643,17.375 H 18.75125 L 13.444285,3.25 h -2.52232 z m 4.459465,-5.66009 2.048125,-5.8416954 h 0.12107 l 2.048125,5.8416954 z" fillOpacity="1"></path>
      <path className="activeColor" d="M0 20h24v4H0z" fillOpacity="1" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5"></path>
    </SvgIcon>
  );
}

export default ColorizedTextIcon;