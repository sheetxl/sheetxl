import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const TextUnderlineDoubleIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="m 17.983101,9.6935009 q 0,3.6331771 -2.067499,5.4798741 Q 13.868177,17 10.154709,17 H 6.1000033 V 2.668021 H 10.59631 q 2.248154,0 3.894124,0.802912 1.666042,0.802912 2.569318,2.3685904 0.923349,1.5456056 0.923349,3.8539775 z m -3.15143,0.080291 q 0,-2.3886631 -1.043785,-3.4926671 Q 12.7441,5.1570482 10.756893,5.1570482 H 9.130996 V 14.4909 h 1.304732 q 4.395943,0 4.395943,-4.7171079 z"
      />
      <path
        className="styled info"
        d="m 5,21.242188 v 1.671875 H 19 V 21.242188 Z M 5,18.75 v 1.671875 H 19 V 18.75 Z"
      />
    </SvgIcon>
  );
}

export default TextUnderlineDoubleIcon;