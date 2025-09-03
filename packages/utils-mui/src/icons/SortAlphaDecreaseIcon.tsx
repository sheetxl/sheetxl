import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SortAlphaDecreaseIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 5.4887958,12.953787 h 1.837901 L 11.715788,23.075914 H 9.2194943 L 8.3416002,20.936286 H 4.419024 L 3.5687117,23.075914 H 1.1 Z m 0.8777113,2.935044 -1.2343628,3.154503 h 2.4687116 z"
      />
      <path
        d="M 2.4439309,8.564781 7.5735694,2.475051 H 2.6359489 V 0.5 h 7.6533171 v 1.975051 l -5.0473428,6.08973 h 5.2119338 v 2.057346 H 2.4439309 Z"
      />
      <path
        className="styled info"
        d="M 20.202477,19.637439 V 15.475778 11.457369 7.1143038 H 23.1 l -4.346257,-4.180723 -4.346256,4.180723 h 2.897523 v 4.3430652 4.018409 4.161661 z"
      />
    </SvgIcon>
  );
}

export default SortAlphaDecreaseIcon;