import React, { memo, forwardRef } from 'react';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';
import { alpha } from '@mui/system';

import { Box } from '@mui/material';

import { CheckIcon } from '../icons/CheckIcon';
import { BlankIcon } from '../icons/BlankIcon';

import { themeIcon } from '../theme';

export interface SelectedIconProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * If this is set to false then will just render as a regular icon.
   * @defaultValue true
   *
   */
  selected?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  outlined?: boolean;
}

const SelectedIcon = memo(forwardRef<HTMLDivElement, SelectedIconProps>((props: SelectedIconProps, refForwarded) => {
  const {
    children : propChildren,
    selected = true,
    outlined=true,
    sx: propSX,
    ...rest
  } = props;

  const style = {
    display: 'flex',
    // padding: '1px 1px',
    border: (theme: Theme) => {
      if (!selected)
        return `solid transparent 1px`; // to preserve sizing
      // return 'red solid 1px';
      return `solid ${(outlined ? theme.palette.divider : "transparent")} 1px`
    },
    borderRadius : (theme: Theme) => `${theme.shape.borderRadius}px`,
    backgroundColor: (theme: Theme) => {
      if (!selected)
        return;
      return alpha(((theme.palette.text as any).icon ?? theme.palette.action.active), theme.palette.action.selectedOpacity);
    }
  };

  let children = propChildren;
  if (children === null)
    children = <BlankIcon/>;
  if (!children)
    children = <CheckIcon/>;
  children = themeIcon(children as any);

  return (
    <Box
      ref={refForwarded}
      sx={{
        ...style,
        ...propSX
      }}
      {...rest}
    >
      { children }
    </Box>
  );
}));

export { SelectedIcon };
export default SelectedIcon;