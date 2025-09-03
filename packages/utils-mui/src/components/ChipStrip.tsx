import React, { memo, forwardRef } from 'react';

import { Box, BoxProps } from '@mui/material';
import { Chip } from '@mui/material';

export interface ChipStripProps extends BoxProps {
  chips: string | string[] | React.ReactNode | React.ReactNode[];
}

export const ChipStrip: React.FC<ChipStripProps & { ref?: any }> = memo(
  forwardRef<any, ChipStripProps>((props, refForwarded) => {
  const {
    chips: propChips,
    sx: propSx,
    ...rest
  } = props;

  const chipElements = React.useMemo(() => {
    if (!propChips)
      return null;
    let chips: string[] | React.ReactNode[] = null;
    chips = Array.isArray(propChips) ? propChips : [propChips];

    const retValue = [];
    for (let i=0; i<chips.length; i++) {
      const chip = chips[i];
      let element = null;
      if (typeof chip === 'string') {
        element = (
          <Chip
            key={"chip-" + i}
            label={chip as string}
            color={"primary"}
            size="small"
            sx={{
              scale: '0.8'
            }}
          />
        );
      } else {
        React.cloneElement(chip as any, {
          key: "chip-" + i
        });
      }
      retValue.push(element);
    }

    return retValue;
  }, [propChips]);

  return (
    <Box
      ref={refForwarded}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        marginLeft: '4px',
        gap: '2px',
        ...propSx
      }}
      {...rest}
    >
      {chipElements}
    </Box>
  );
}));