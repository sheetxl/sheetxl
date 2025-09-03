import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const SystemDefaultDarkMode = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"
      />
      <path
        className="styled info"
        d="m 12,7.0668288 c -2.2088889,0 -4,1.7911111 -4,3.9999992 0,2.208889 1.7911111,4 4,4 2.208889,0 4,-1.791111 4,-4 0,-0.204445 -0.01778,-0.408889 -0.04445,-0.604445 C 15.52,11.071273 14.808889,11.466828 14,11.466828 c -1.324445,0 -2.4,-1.075555 -2.4,-2.3999992 0,-0.8044445 0.395555,-1.52 1.004445,-1.9555555 -0.195556,-0.026667 -0.4,-0.044444 -0.604445,-0.044444 z"
      />
    </SvgIcon>
  );
}

export default SystemDefaultDarkMode;