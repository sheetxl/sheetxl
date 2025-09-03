import React, { memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';

import { Typography, TypographyProps } from '@mui/material';

export interface ExhibitMenuHeaderProps extends TypographyProps {
  /**
   * If the icon button is a secondary text button.
   * Changes the color of the text and icon.
   * @defaultValue false
  */
  primary?: boolean;

  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'overline';
}

export const ExhibitMenuHeader: React.FC<ExhibitMenuHeaderProps & { ref?: any }> = memo(
  forwardRef<any, ExhibitMenuHeaderProps>((props, refForwarded) => {
  const {
    children,
    sx: sxProps,
    primary=false,
    variant='subtitle1',
    ...rest
  } = props;

  return (<>
    <Typography
      ref={refForwarded}
      variant={variant}
      component="div"
      sx={{
        userSelect: 'none',
        fontWeight: '500',
        paddingLeft: '8px',
        paddingTop: variant === 'subtitle1' ? '2px' : undefined,
        paddingBottom: variant === 'subtitle1' ? '2px' : undefined,
        color: (theme: Theme) => {
          // if dark mode we use the secondary text color.
          return !primary ? theme.palette.text.secondary : undefined; // default
        },
        ...sxProps
      }}
      {...rest}
    >
      {children}
    </Typography>
  </>);
}));