import { deepmerge } from '@mui/utils';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { CommonUtils } from '@sheetxl/utils';
import { elevateColor } from './ExhibitTheme';

export interface ScrollbarThemingOptions  {
  track?: string;
  thumb?: string;
  active?: string;
  corner?: string;
  outline?: boolean;
}

export function scrollbarTheming(theme: Theme, options?: ScrollbarThemingOptions) {
  options = deepmerge({
    track: elevateColor(theme.palette.background.paper, 0.05, theme?.palette.mode),//'#e6e6e6', //elevateColor(theme.palette.background.paper, 0.05, theme.palette.mode
    thumb: elevateColor(theme.palette.background.paper, 0.30, theme?.palette.mode),//'#6b6b6b',
//     active: elevateColor(theme.palette.elevateColor(theme.palette.background.paper, 0.30), -.25)
    active: theme.palette.primary.main,
//     outline: `1px solid ${theme.palette.primary.dark}`,
    corner: theme.palette.background.paper,
    outline: false
  }, options || {});

  const themeScrollbar = {
    // scrollbarColor: `${options.track} ${options.track}`,
    "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
      backgroundColor: alpha(options.track, 0.2),
      width: '13px', //'1.2em',
      height: '13px', //'1.2em'
    },
    "&::-webkit-scrollbar-button": {
      display: 'none'
    },
    "& .scrollbar-button": {
      fill: options.thumb,
      backgroundColor: 'transparent',
      transition: "fill opacity 260ms ease",
      width: '13px', //'1.2em',
      height: '13px', //'1.2em'
    },
    "& .scrollbar-button:hover:not([disabled])": {
      fill: options.active,
    },
    "& .scrollbar-button:disabled": {
      //fill: alpha(options.track, 0.8),
      opacity: 0.8
    },
    "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {},
    "&::-webkit-scrollbar-track-piece, & *::-webkit-scrollbar-track-piece": {},
    "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
      borderRadius: 8,
      backgroundColor: options.thumb,
      minHeight: '24px', //'1.8em',
      minWidth: '24px', //'1.8em',
      border: `2px solid ${options.track}`,
    },
    "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus": {
      backgroundColor: options.active,
      border: (options.outline ? options.outline : undefined),
    },
    "&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active": {
      backgroundColor: options.active,
      border: (options.outline ? options.outline : undefined)
      //boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
      //webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)'
    },
    "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover": {
      backgroundColor: options.active,
      border: (options.outline ? options.outline : undefined),
      //boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
      //webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)'
    },
    "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
      backgroundColor: options.corner || options.thumb,
    },
  }

  /* FireFox does support scroll theming */
  if (CommonUtils.getOS() === CommonUtils.OSType.Firefox) {
    themeScrollbar["* .pseudo-scrollbar"] = {
      scrollbarColor: `${options.thumb} transparent`
    }
    themeScrollbar["* .pseudo-scrollbar:hover:not([disabled])"] = {
      scrollbarColor: `${options.active} transparent`
    }
  }
  return themeScrollbar;
}
