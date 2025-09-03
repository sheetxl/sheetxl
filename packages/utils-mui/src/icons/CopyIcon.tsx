import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

/**
 * TODO - allow this to take additional color option and and animation option (to enabled when copy/cut mode is active)
 */
export const CopyIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <g>
        <path
          d="M 16,1 H 4 C 2.9,1 2,1.9 2,3 V 17 H 4 V 3 h 12 z"
        />
        {/* <path
          className="info"
          d="M 19,5 H 8 C 6.9,5 6,5.9 6,7 v 14 c 0,1.1 0.9,2 2,2 h 11 c 1.1,0 2,-0.9 2,-2 V 7 C 21,5.9 20.1,5 19,5 Z m 0,16 H 8 V 7 h 11 z"
        /> */}
        <rect x="7" y="6" width="13" height="16" rx="1.5"
          className="styled info stroked"
          style= {{
            fill: 'none',
            strokeWidth: '2px',
            // stroke: `var(--sxl-app-color-info, currentColor)`,
            vectorEffect: 'non-scaling-stroke',
            // strokeDashoffset: '10px',
            /* stroke-dasharray: 4px, 1px; */
            // animation: '1500ms linear 0s infinite normal none running walking-offset-r4h'
          }}
        />
      </g>
    </SvgIcon>
  );
}

export default CopyIcon;