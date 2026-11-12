import type React from 'react';

import { darken, lighten, alpha } from '@mui/system';
import { deepmerge } from '@mui/utils';
import { createTheme } from '@mui/material';
import {
  type Theme, type ThemeOptions, type Components, type ComponentsProps, type ComponentsOverrides,
  type ComponentsVariants, type ComponentsPropsList, type Interpolation
} from '@mui/material';

import { ArrowDownIcon } from './IconSupport';

// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
const shortHandRegEx2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export const hexToRGB = function(hex: string, alpha: number | null=null): string {
  if (!hex) return hex;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });
  let result = shortHandRegEx2.exec(hex);
  if (!result) return hex;

  if (alpha === null)
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
  return `rgb(${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)} / ${alpha * 100}%)`;
}

export const elevateColor = function(color: string, coefficient: number=0.2, mode: "light" | "dark"="light"): string {
  if (!color)
    return color;
  let isDarken = mode !== "dark";
  if (coefficient < 0) {
    isDarken = !isDarken;
    coefficient *= -1;
  }
  color = hexToRGB(color);
  // MUI's `darken`/`lighten` THROW on anything `decomposeColor` can't parse — a `var(--x)` reference, a CSS
  // named color, `color-mix(…)`. Those all arrive legitimately now that a host can hand us its own colors
  // (an explicit token feeds this math), and an unstyleable shade is never worth taking the app down for:
  // fall back to the color as given, which just means "this surface doesn't get its elevation step".
  try {
    if (isDarken) {
        return darken(color, Math.max(0, Math.min(1, coefficient * 1)));
    } else {
        return lighten(color, Math.max(0, Math.min(1, coefficient * 1.5)));
    }
  } catch {
    return color;
  }
}

// TODO - move and import
export interface SmartInputFieldProps {
  automatic?: any;
}

export interface ExhibitComponentPropsList extends ComponentsPropsList {
  SmartInputField?: SmartInputFieldProps;
}
export interface ExhibitComponentProps extends ComponentsProps  {
  SmartInputField: SmartInputFieldProps;
};

export interface ExhibitComponentsOverrides<Theme = unknown> extends ComponentsOverrides<Theme> {
  SmartInputField?: any; // TODO - fix typing
};

export interface ExhibitComponentsVariants extends ComponentsVariants {
  SmartInputField?: Array<{
    props: Partial<ExhibitComponentPropsList['SmartInputField']>;
    style: Interpolation<{ theme: Theme }>;
  }>;
}
export interface ExhibitComponents extends Components<Omit<Theme, 'components'>> {
  SmartInputField?: {
    defaultProps?: ExhibitComponentProps['SmartInputField'];
    styleOverrides?: ExhibitComponentsOverrides<Theme>['SmartInputField'];
    variants?: ExhibitComponentsVariants['SmartInputField'];
  };
}
export interface ExhibitThemeOptions extends ThemeOptions {
  components?: ExhibitComponents;
}

/**
 *
 * This creates a Theme that has Exhibit Widget extensions.
 * It is based on the MUI createTheme() function.
 *
 * @see
 * https://mui.com/customization/how-to-customize/#state-classes
 */

/**
 * A Select's or a Menu's popup is part of the control that opened it, but it portals out of the
 * control's DOM. A float that light-dismisses on a press outside itself (`useFloatStack`,
 * `useOnClickOrFocusAway`) would read the first press in the popup as a press away and close the
 * control's host. The press stays with the popup.
 */
const stopPress = (event: React.SyntheticEvent): void => { event.stopPropagation(); };
const pressStaysInPopup = {
  onMouseDown: stopPress,
  onTouchStart: stopPress
};

export const createExhibitTheme = (isDark: boolean, customizations?: ExhibitThemeOptions): Theme => {
  let original = createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light'
    },
  });

  // The per-semantic `--icon-*` color vars (primary/secondary/success/…) were a fallback layer that
  // paralleled `--sxl-color-*`; they're dead now that `DynamicIcon` reads the `--sxl-color-*` tokens directly
  // (with hardcoded hex fallbacks). Only two survive: `--icon-shadow` (a mode-aware icon drop-shadow used by
  // the Base pack) and `--icon-size` (structural sizing consumed by `DynamicIcon.module.css`).
  const styleIcons = {
    '--icon-shadow': isDark ? original.palette.text.primary : original.palette.divider,
    '--icon-size': '1.25rem',
    '@media (pointer: coarse)': {
      '--icon-size': '1.75rem',
    },
  }
  const darkAlpha = 0.70;
  const lightAlpha = 0.75;
  let exhibitDefaults:ExhibitThemeOptions = {
    typography: {
      // htmlFontSize,
      // fontSize: 14
    },
    palette: {
      mode: isDark ? 'dark' : 'light',
      // `secondary` is deliberately NOT stated here. This layer injects the MUI app's palette into the
      // token system; branding is expressed by the app's own `muiTheme`, not baked in here. So an unset
      // slot falls through to MUI's default, and `--sxl-color-accent` follows it — that is the seam
      // working. `defaultTheme`'s accent is the UNBRANDED floor for an app with no theme at all; pulling a
      // themed app back to it would defeat the injection.
      text: {
        // Move to somewhere else
        secondary: !isDark ? alpha(original.palette.text.secondary, lightAlpha) : original.palette.text.secondary,
        //@ts-ignore
        icon: !isDark ? alpha(original.palette.text.primary, lightAlpha) : alpha(original.palette.text.secondary, darkAlpha),
      }
    },
    components: {
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontWeight: 'normal',
            // padding: '16px 24px 0px 24px'
          }
        }
      },
      MuiSelect: {
        defaultProps: {
          IconComponent: ArrowDownIcon,
          MenuProps: {
            container: () => {
              // console.log('MuiSelect: Fullscreen:', document.fullscreenElement);
              return document.fullscreenElement
            },
            ...pressStaysInPopup
          }
        },
        styleOverrides: {
          // v9 removed the variant-specific icon classes (iconOutlined/iconFilled/
          // iconStandard); `icon` covers all variants.
          icon: {
            top : 'unset'
          }
        }
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: '0px !important',
            overflow: 'hidden',
            marginLeft: '0px',
            marginRight: '6px',
            padding: '1px 1px',
            // paddingTop: '2px',
            // paddingBottom: '2px',
            // backgroundColor: 'pink'
            // background: 'pink',
            border: `solid transparent 1px`, // needed to aligned to select icon border
            color: 'unset'
            // },
          }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            paddingTop: '2px',
            paddingBottom: '2px',
            marginLeft: '4px',
            marginRight: '4px',
            paddingLeft: '6px',
            paddingRight: '18px',
            borderRadius: '4px',
            fontSize: '0.875em',
            '@media (pointer: coarse)': {
              fontSize: '1em',
            },
            '&.Mui-selected': {
            }
          }
        }
      },
      MuiMenu: {
        defaultProps: {
          // Not sure why this isn't the default behavior?
          // TODO - useFullScreen hook
          container: () => {
            // console.log('MuiMenu: Fullscreen:', document.fullscreenElement);
            return document.fullscreenElement
          },
          ...pressStaysInPopup
        },
        styleOverrides: {
          root: {
            paddingTop: '2px',
            paddingBottom: '2px',
            marginLeft: '4px',
            marginRight: '4px',
            paddingLeft: '6px',
            paddingRight: '18px',
            borderRadius: '4px',
            fontSize: '0.875em',
            '@media (pointer: coarse)': {
              fontSize: '1em',
            },
            '&.Mui-selected': {
            }
          }
        }
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            paddingTop: '4px',
            paddingBottom: '4px',
            '@media (min-width: 600px)': {
              paddingTop: '4px',
              paddingBottom: '4px'
            },
          }
        }
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            marginTop: '4px !important', // mui-menu item is ignoring
            marginBottom: '4px  !important',  // mui-menu item is ignoring
            marginLeft: '0px',
            // marginTop: '0px',
            marginRight: '0px',
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            // height: '1rem',
            // '> input': {
            //   height: '1rem',
            // }
            // backgroundColor: isDark ? alpha(original.palette.background.paper, 0.5) : original.palette.background.paper,
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...styleIcons,
            // No Material elevation wash. In dark mode a raised `Paper` paints `background-image:
            // var(--Paper-overlay)` — a per-elevation white gradient set as an INLINE style (Paper.js) — so
            // it can only be defeated at the `background-image` itself, and it has to be done here, once,
            // for every Paper (menus are elevation 8, dialogs 24, the studio root 1). Every fill that should
            // read "raised" is STATED — `--sxl-color-elevated`, the header cell, the studio brand — so the
            // wash only ever stacked a second lift on top of them: the near-black desktop came out a mid
            // grey and the toolbar a lighter band floating on it. Depth is the fill + the shadow (+ an
            // optional `--sxl-color-elevated-border`), never a wash.
            backgroundImage: 'none'
          }
        }
      },
      // MUI-native popups (`Menu` renders through `Popover`, so this covers both) never went through
      // `ExhibitFloatPanel`, so they missed the raised-container treatment entirely — a select's dropdown
      // and a right-click menu were bare paper. Same two tokens as every other raised surface, so they
      // stay consistent with the studio's own float panels. Both default to a no-op.
      MuiPopover: {
        styleOverrides: {
          paper: {
            // The last-resort fallback must be MODE-aware, not `#fff`: a Popover portals to
            // `document.body`, which sits outside the container carrying the `--sxl-*` token scope
            // (`data-sxl-theme-mode` / the studio's `@scope` class), so in dark mode neither token
            // resolved and a hard `#fff` painted white menus under white text.
            backgroundColor: `var(--sxl-color-elevated, var(--sxl-color-base-100, ${original.palette.background.paper}))`,
            border: '1px solid var(--sxl-color-elevated-border, transparent)'
          }
        }
      },
      MuiPopper: {
        styleOverrides: {
          root: {
            // ...styleIcons,
            '& .menu': {
              marginTop: '4px',
              marginBottom: '4px',
              borderRadius: '4px'
            }
          }
        },

      },
      SmartInputField: {
        styleOverrides: {
          automatic: {
    //         opacity: "0.42", // setting opacity sets the spinner too
            transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            color: function () {
  //                  return 'green';
                return original.palette.text.secondary;
    //          return themeEffective.palette.augmentColor('red')
    //          return alpha(themeEffective.text.secondary, 1)
              }
          },
          dirty: {
            fontStyle: "italic",
            color: function () {
              // return 'red';
              return original.palette.text.secondary;
            }
          }
        }
      }
    }
  };

  let overrides = exhibitDefaults;
  if (customizations) {
    overrides = deepmerge(exhibitDefaults, customizations);
  }
  // const effectiveOverrides = deepmerge(original, overrides);
  const effective = createTheme(overrides);
  return effective;
}