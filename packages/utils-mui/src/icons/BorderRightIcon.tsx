import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderRightIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 7,21 H 9 V 19 H 7 Z M 3,5 H 5 V 3 H 3 Z M 7,5 H 9 V 3 H 7 Z m 0,8 H 9 V 11 H 7 Z M 3,21 H 5 V 19 H 3 Z m 8,0 h 2 V 19 H 11 Z M 3,13 H 5 V 11 H 3 Z m 0,4 H 5 V 15 H 3 Z M 3,9 H 5 V 7 H 3 Z m 8,8 h 2 v -2 h -2 z m 4,-4 h 2 v -2 h -2 z m 0,8 h 2 V 19 H 15 Z M 15,5 h 2 V 3 h -2 z m -4,8 h 2 v -2 h -2 z m 0,-8 h 2 V 3 h -2 z m 0,4 h 2 V 7 h -2 z"
      />
      <path
        className="styled activeColor"
        d="m 19,3 v 18 h 2 V 3 Z"
      />
    </SvgIcon>
  );
}

export default BorderRightIcon;