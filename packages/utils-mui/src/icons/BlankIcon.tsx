import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const BlankIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path/>
    </SvgIcon>
  );
}