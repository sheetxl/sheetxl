import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextHorizontalOverflowIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 12,21.888913 v -7 h 2 v 7 z M 12,9 V 2 h 2 V 9 Z M 4,2 V 21.999938 H 2 V 2 Z"
      />
      <path
        className="styled info"
        d="m 6,12.91274 h 3.9862992 3.8490838 4.160058 v 2.554311 L 22,11.635609 17.995441,7.8041663 V 10.358479 H 13.835383 9.9863002 6 Z"
      />
    </SvgIcon>
  );
}

export default TextHorizontalOverflowIcon;