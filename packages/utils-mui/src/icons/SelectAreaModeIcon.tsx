import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SelectAreaModeIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 21.959814,6.9598131 h -2 v 2 h 2 z m -18,0 h -2 v 2 h 2 z m 0,7.9999999 h -2 v 2 h 2 z m 0,-4 h -2 v 2 h 2 z m 4.9999995,9 h -2 v 2 h 2 z m -7.0000005,-1 h 2 v 1 h 1 v 2 h -3 z M 16.959814,1.9598131 h -2 v 2 h 2 z m -12.000001,2 h -1 v 1 h -2 v -3 h 3 z m 4.0000005,-2 h -2 v 2 h 2 z m 4.0000005,0 h -2 v 2 h 2 z m 9,3 h -2 v -1 h -1 v -2 h 3 z"
      />
      <path
        className="styled info"
        d="m 15.959814,18.859813 -3,3.1 -2,-11 11,2 -3.1,3 3.1,3.2 -2.8,2.8 z"
      />
    </SvgIcon>
  );
}

export default SelectAreaModeIcon;