import React, { memo, forwardRef } from 'react';

import clsx from 'clsx';

import { DynamicIcon, type DynamicIconProps } from '@sheetxl/utils-react';

import { Theme, styled } from '@mui/material/styles';
import { Box, BoxProps } from '@mui/material';

export interface ThemedIconProps extends BoxProps {
  size?: 'small' | 'medium' | 'large';

  activeColor?: string;
}

/**
 * Useful for contrasting colors
 * @param theme - The theme
 */
export const strokeShadowFilter = (theme: Theme) => {
  if (theme.palette.mode !== 'dark')
    return;
  const shadowRadius = 1;
  // TODO - perhaps we should show shadow if there is a contrast between stroke and background?
  const shadowColor = (theme.palette.mode === 'dark') ? theme.palette.text.primary : theme.palette.divider;
  // const shadowColor = (theme.palette.mode === 'dark') ? theme.palette.text.secondary : theme.palette.divider;
  return `drop-shadow(0px 0px ${shadowRadius}px ${shadowColor})`;
}

export const createStrokeShadowFilter = (shadowRadius: number=1) => {
  return (theme: Theme) => {
    if (theme.palette.mode !== 'dark')
      return;
    // TODO - perhaps we should show shadow if there is a contrast between stroke and background?
    const shadowColor = (theme.palette.mode === 'dark') ? theme.palette.text.primary : theme.palette.divider;
    // const shadowColor = (theme.palette.mode === 'dark') ? theme.palette.text.secondary : theme.palette.divider;
    return `drop-shadow(0px 0px ${shadowRadius}px ${shadowColor})`;
  }
}

export const ArrowDownIcon = (props: DynamicIconProps) => {
  return <DynamicIcon {...props} iconKey="ArrowDownOutline"/>
}

export const ArrowRightIcon = (props: DynamicIconProps) => {
  return <DynamicIcon {...props} iconKey="ArrowRightOutline"/>;
}

const ThemeableIcon: React.FC<ThemedIconProps & { ref?: any }> = memo(
  forwardRef<React.ReactElement<any, any>, ThemedIconProps>((props, refForwarded) => {
  const {
    sx: sxProps,
    size = 'medium',
    activeColor,
    children,
    className: propClassName,
    ...rest
  } = props;

  // to trigger invalidation

  // let padding;
  let sizeAdj: any = 'var(--icon-size)';
  if (size === 'small') {
    sizeAdj = 'calc(var(--icon-size-sm) * .875)';
    // padding = '2px 2px';
  } else if (size === 'large') {
    sizeAdj = 'calc(var(--icon-size-lg) * 1.5)';
    // padding = '4px 4px';
  }

  return (
    <Box
      ref={refForwarded}
      className={clsx("icon", propClassName)}
      sx={{
        width: 'var(--icon-size)',
        height: 'var(--icon-size)',
        '--icon-size-adj': sizeAdj,
        // padding,
        ...sxProps
      }}
      {...rest}
    >
      {children}
    </Box>
  );

}));

const ThemedIcon:any = styled(ThemeableIcon)(({ theme }) => {
  return {
    fontSize: 'var(--icon-size-adj)',
    minWidth: 'var(--icon-size-adj)',
    minHeight: 'var(--icon-size-adj)',
    fill: "currentColor",
    '& .activeColor': {
      fill: theme.palette.primary.main//`${activeColor ? activeColor : 'currentColor'}`;
    },
    "& .styled.high_contrast": { // style_HighContrast
      fill: theme.palette.primary.main, //"currentColor", // theme.palette.augmentColor,//
    },
    "& .styled.background": { // style_m20 - office always makes this white
      fill: theme.palette.background.paper,
    },
    "& .styled.current_color": { // style_m22 - This is the lines we want this to be 'grey or white as defined on a regular icon'
      fill: "currentColor",
    },
    "& .styled.secondary": { // no office equivalent
      fill: theme.palette.secondary.main,
    },
    "& .styled.secondary_dark": { // style_m23
      fill: theme.palette.secondary.dark,
    },
    "& .styled.secondary_light": { // style_m21 - office always makes this grey
      fill: theme.palette.secondary.light,
    },
    "& .styled.info": { // style_m24
      fill: theme.palette.info.main,
    },
    "& .styled.info.stroked": { // style_m24
      stroke: theme.palette.info.main,
    },
    "& .styled.info_dark": { // style_m25
      fill: theme.palette.info.dark,
    },
    "& .styled.info_light": { // style_m26
      fill: theme.palette.info.light,
    },
    "& .styled.warning": {
      fill: theme.palette.warning.main,
    },
    "& .styled.warning.stroked": {
      stroke: theme.palette.warning.main,
    },
    "& .styled.warning_dark": {
      fill: theme.palette.warning.dark,
    },
    "& .styled.warning_light": {
      fill: theme.palette.warning.light,
    },
    "& .styled.error.info": {
      fill: theme.palette.error.main,
    },
    "& .styled.error.stroked": {
      stroke: theme.palette.error.main,
    },
    "& .styled.error_dark": {
      fill: theme.palette.error.dark,
    },
    "& .styled.error_light": {
      fill: theme.palette.error.light,
    },
    "& .styled.success": {
      fill: theme.palette.success.main,
    },
    "& .styled.success_dark": {
      fill: theme.palette.success.dark,
    },
    "& .styled.success_light": {
      fill: theme.palette.success.light,
    },
    "& .styled.grey": { // style_m26
      fill: ((theme.palette.text as any).icon ?? theme.palette.action.active),
    }
  }
});

export { ThemedIcon };