import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const CellSelectionIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 3 3 L 3 21 L 14.587891 21 L 14.587891 19 L 5 19 L 5 5 L 19 5 L 19 14.298828 L 21 14.298828 L 21 3 L 3 3 z"
      />
      <path
        className="styled info"
        d="M 22.132849,17.187826 H 17.41854 v 4.714309 h 4.714309 z"
      />
    </SvgIcon>
  );
}

export default CellSelectionIcon;