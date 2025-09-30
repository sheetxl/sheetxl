import { deepmerge } from '@mui/utils';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { CommonUtils } from '@sheetxl/utils';
import { elevateColor } from './ExhibitTheme';

export interface ScrollbarThemingOptions  {
  track?: string;
  thumb?: string;
  button?: string;
  active?: string;
  corner?: string;
  outline?: boolean;
}

export function getScrollbarCssVariables(theme: Theme, options?: ScrollbarThemingOptions) {
  options = deepmerge({
    track: elevateColor(theme.palette.background.paper, 0.05, theme?.palette.mode),
    thumb: elevateColor(theme.palette.background.paper, 0.30, theme?.palette.mode),
    active: theme.palette.primary.main,
    corner: theme.palette.background.paper,
    outline: false
  }, options || {});

  return {
    '--scrollbar-track-color': alpha(options.track, 0.2),
    '--scrollbar-thumb-color': options.thumb,
    '--scrollbar-button-color': options.button || options.thumb,
    '--scrollbar-active-color': options.active,
    '--scrollbar-corner-color': options.corner || options.thumb,
    '--scrollbar-border-color': options.track,
    '--scrollbar-width': '13px',
    '--scrollbar-height': '13px',
    '--scrollbar-border-radius': '9999px',
    '--scrollbar-border-width': '2px',
    '--scrollbar-min-thumb-size': '24px',
  };
}

export function scrollbarTheming(theme: Theme, options?: ScrollbarThemingOptions) {
  // Get the CSS variables for consistent theming
  const scrollbarVariables = getScrollbarCssVariables(theme, options);

  const themeScrollbar = {
    // Add CSS variables to root - these can be inherited by custom scrollbars
    ...scrollbarVariables,

    // Custom scrollbar classes can inherit these variables
    "& .scrollbar, & .vsb-track, & .vsb-thumb": {
      // Make variables available to custom scrollbar components
      ...scrollbarVariables,
    },

    // Native webkit scrollbar styles using the same variables
    "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
      backgroundColor: 'var(--scrollbar-track-color)',
      width: 'var(--scrollbar-width)',
      height: 'var(--scrollbar-height)'
    },
    "&::-webkit-scrollbar-button": {
      display: 'none'
    },
    "& .scrollbar-button": {
      fill: 'var(--scrollbar-thumb-color)',
      backgroundColor: 'transparent',
      transition: "fill opacity 260ms ease",
      width: 'var(--scrollbar-width)',
      height: 'var(--scrollbar-height)'
    },
    "& .scrollbar-button:hover:not([disabled])": {
      fill: 'var(--scrollbar-active-color)',
    },
    "& .scrollbar-button:disabled": {
      opacity: 0.8
    },
    "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {},
    "&::-webkit-scrollbar-track-piece, & *::-webkit-scrollbar-track-piece": {},
    "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
      borderRadius: 'var(--scrollbar-border-radius)',
      backgroundColor: 'var(--scrollbar-thumb-color)',
      minHeight: 'var(--scrollbar-min-thumb-size)',
      minWidth: 'var(--scrollbar-min-thumb-size)',
      border: `var(--scrollbar-border-width) solid var(--scrollbar-border-color)`,
    },
    "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus": {
      backgroundColor: 'var(--scrollbar-active-color)',
      border: (options?.outline ? options.outline : undefined),
    },
    "&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active": {
      backgroundColor: 'var(--scrollbar-active-color)',
      border: (options?.outline ? options.outline : undefined)
    },
    "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover": {
      backgroundColor: 'var(--scrollbar-active-color)',
      border: (options?.outline ? options.outline : undefined),
    },
    "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
      backgroundColor: 'var(--scrollbar-corner-color)',
    },
  }

  /* FireFox does support scroll theming */
  if (CommonUtils.getOS() === CommonUtils.OSType.Firefox) {
    themeScrollbar["* .pseudo-scrollbar"] = {
      scrollbarColor: `var(--scrollbar-thumb-color) transparent`
    }
    themeScrollbar["* .pseudo-scrollbar:hover:not([disabled])"] = {
      scrollbarColor: `var(--scrollbar-active-color) transparent`
    }
  }

  return themeScrollbar;
}
