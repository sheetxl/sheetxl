import { DynamicIcon, type DynamicIconProps } from '@sheetxl/utils-react';

import { type Theme } from '@mui/material';

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
