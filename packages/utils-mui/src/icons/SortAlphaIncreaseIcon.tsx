import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SortAlphaIncreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 5.4887958,0.5 h 1.837901 L 11.715788,10.622127 H 9.2194943 L 8.3416002,8.4824991 H 4.419024 L 3.5687117,10.622127 H 1.1 Z M 6.3665071,3.4350437 5.1321443,6.5895469 h 2.4687116 z"
      />
      <path
        d="m 2.4439309,21.018568 5.1296385,-6.08973 H 2.6359492 v -1.975051 h 7.6533168 v 1.975051 l -5.0473428,6.08973 h 5.2119338 v 2.057346 H 2.4439309 Z"
      />
      <path
        className="styled info"
        d="m 17.30501,2.9335808 v 4.1616606 4.0184096 4.343065 H 14.407487 L 18.753744,19.637439 23.1,15.456716 H 20.202477 V 11.113651 7.0952414 2.9335808 Z"
      />
    </SvgIcon>
  );
}

export default SortAlphaIncreaseIcon;