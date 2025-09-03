import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SortIncreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        className="styled info"
        d="M 9.0065407,14.665821 H 6.0065367 V 4.6658205 h -2 V 14.665821 h -3 l 4,4 z"
      />
      <path
        d="m 10.722257,6.8830305 v -1.50391 h 4.88082 v 1.50391 z m 0,3.5809205 V 8.9600505 h 7.099404 v 1.5039005 z m 0,3.58085 v -1.50391 h 9.317921 v 1.50391 z m 0,3.58092 v -1.50391 h 11.536489 v 1.50391 z"
      />
    </SvgIcon>
  );
}

export default SortIncreaseIcon;