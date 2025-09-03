import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextBoldIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 15.500659,11.85365 c 0.97,-0.67 1.65,-1.77 1.65,-2.79 0,-2.2599999 -1.75,-3.9999999 -4,-3.9999999 H 6.9006595 V 19.06365 h 7.0399995 c 2.09,0 3.71,-1.7 3.71,-3.79 0,-1.52 -0.86,-2.82 -2.15,-3.42 M 9.9006595,7.5636501 h 2.9999995 c 0.83,0 1.5,0.6699999 1.5,1.4999999 0,0.83 -0.67,1.5 -1.5,1.5 H 9.9006595 Z M 13.400659,16.56365 H 9.9006595 v -3 h 3.4999995 c 0.83,0 1.5,0.67 1.5,1.5 0,0.83 -0.67,1.5 -1.5,1.5"
      />
    </SvgIcon>
  );
}

export default TextBoldIcon;