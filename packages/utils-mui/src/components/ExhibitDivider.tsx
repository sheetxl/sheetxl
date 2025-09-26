import React, { memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';

import { Divider, DividerProps } from '@mui/material';

export interface ExhibitDividerProps extends DividerProps {
}

export const ExhibitDivider = memo(forwardRef<HTMLHRElement, ExhibitDividerProps>((props, refForwarded) => {
  const {
    orientation = 'vertical',
    sx: propSx,
    ...rest
  } = props;

  const isVertical = orientation === 'vertical';
  return (
    <Divider
      ref={refForwarded}
      // light
      sx={{
        marginLeft: isVertical ? '2px' : undefined,
        marginRight: isVertical ? '2px' : undefined,
        // marginBottom: !isVertical ? '2px !important' : undefined, // mui is override margin. sometimes.
        // marginTop: !isVertical ? '2px !important' : undefined, // mui is override margin. sometimes.
        backgroundColor: 'transparent !important',
        minHeight: isVertical ? '1em' : undefined,
        minWidth: !isVertical ? '1em' : undefined,
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
