import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SortDecreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        className="styled info"
        d="M 9.0065407,14.665821 H 6.0065367 V 4.6658205 h -2 V 14.665821 h -3 l 4,4 z"
      />
      <path
        d="m 10.722257,5.3791205 v 1.50391 h 11.536489 v -1.50391 z"
      />
      <path
        d="m 10.722257,8.9600405 v 1.5039105 h 9.317921 V 8.9600405 Z"
      />
      <path
        d="m 10.722257,12.540891 v 1.5039 h 7.099404 v -1.5039 z"
      />
      <path
        d="m 10.722257,16.121811 v 1.50391 h 4.88082 v -1.50391 z"
      />
    </SvgIcon>
  );
}

export default SortDecreaseIcon;