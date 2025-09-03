import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextHorizontalShrinkIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 21.974894,2.0582915 V 22.058355 h -2 V 2.0582915 Z M 3.999962,1.9999683 V 22.000032 h -2 V 1.9999683 Z"
      />
      <path
        className="styled info"
        d="m 6.2289672,7.8040604 -6.3e-5,8.2560526 h 2.518176 l 2e-5,-2.642838 h 6.4753038 l -2e-5,2.642838 h 2.518175 l 6.1e-5,-8.2560526 h -2.518174 l -2.2e-5,2.9478576 H 8.7471192 l 2.3e-5,-2.9478576 z"
      />
    </SvgIcon>
  );
}

export default TextHorizontalShrinkIcon;