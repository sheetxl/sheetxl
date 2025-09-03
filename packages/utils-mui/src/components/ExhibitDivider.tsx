import React, { memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';

import { Divider, DividerProps } from '@mui/material';

export interface ExhibitDividerProps extends DividerProps {
}

export const ExhibitDivider: React.FC<ExhibitDividerProps & { ref?: any }> = memo(
  forwardRef<any, ExhibitDividerProps>((props, refForwarded) => {
  const {
    orientation = 'vertical',
    sx: propSx,
    ...rest
  } = props;

  const isVertical = orientation === "vertical";
  return (
    <Divider
      ref={refForwarded}
      // light
      sx={{
        marginLeft: isVertical ? '1px' : undefined,
        marginRight: isVertical ? '1px' : undefined,
        // marginBottom: !isVertical ? '2px !important' : undefined, // mui is override margin. sometimes.
        // marginTop: !isVertical ? '2px !important' : undefined, // mui is override margin. sometimes.
        backgroundColor: 'transparent !important',
        borderColor: (theme: Theme) => {
          return theme.palette.divider;
        },
        ...propSx
      }}
      orientation={orientation}
      variant="middle"
      flexItem
      {...rest}
    >
    </Divider>
  );
}));
