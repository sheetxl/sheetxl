import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextHorizontalWrapIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 22.062389,1.9999683 V 22.000032 h -2 V 1.9999683 Z m -18.062427,0 V 22.000032 h -2 V 1.9999683 Z"
      />
      <path
        className="styled info"
        d="m 6.0839844,6.3867187 h 7.4238286 c 2.442808,0 4.423828,1.995808 4.423828,4.4589843 0,2.463178 -1.981061,4.460938 -4.423828,4.460938 H 8.9316406 v 1.404296 L 6.1132812,13.871094 8.9316406,11.03125 v 1.404297 h 4.5761724 c 0.870956,0 1.576171,-0.713095 1.576171,-1.589844 0,-0.8767853 -0.70537,-1.5878905 -1.576171,-1.5878905 H 6.0839844 Z"
      />
    </SvgIcon>
  );
}

export default TextHorizontalWrapIcon;