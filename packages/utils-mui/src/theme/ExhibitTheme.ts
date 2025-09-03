
import { darken, lighten, alpha } from '@mui/system';
import { deepmerge } from '@mui/utils';
import { createTheme } from '@mui/material/styles';
import {
  Theme, ThemeOptions, Components, ComponentsProps, ComponentsOverrides, ComponentsVariants,
  ComponentsPropsList, Interpolation
} from '@mui/material/styles';

import { ArrowDownOutlineIcon } from '../icons';

// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
const shortHandRegEx2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export const hexToRGB = function(hex: string, alpha: number=null): string {
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
  if (isDarken) {
      return darken(color, Math.max(0, Math.min(1, coefficient * 1)));
  } else {
      return lighten(color, Math.max(0, Math.min(1, coefficient * 1.5)));
  }
}

// Inspired by https://github.com/material-components/material-components-ios/blob/bca36107405594d5b7b16265a5b0ed698f85a5ee/components/Elevation/src/UIColor%2BMaterialElevation.m#L61
export const overlayAlpha = function (elevation: number): string {
  let alphaValue = 0;
  if (elevation < 1) {
    alphaValue = 5.11916 * elevation ** 2;
  } else {
    alphaValue = 4.5 * Math.log(elevation + 1) + 2;
  }
  return (alphaValue / 100).toFixed(2);
}

// const DIVIDER_MULTI = 0.12;
// const DIVIDER_SELECT_MULTI = 0.22;

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

export const createExhibitTheme = (isDark: boolean, customizations?: ExhibitThemeOptions): Theme => {
  let original = createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light'
    },
  });

  // let htmlFontSize:number = 12;
  // if (typeof window === "undefined") {
  //   htmlFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  // }

  const darkAlpha = 0.70;
  const lightAlpha = 0.75;
  let exhibitDefaults:ExhibitThemeOptions = {
    typography: {
      // htmlFontSize,
      // fontSize: 14
    },
    palette: {
      mode: isDark ? 'dark' : 'light',
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
          IconComponent: ArrowDownOutlineIcon
        },
        styleOverrides: {
          // Name of the slot
          iconOutlined: {
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
            border: `solid transparent 1px` // needed to aligned to select icon border
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
          container: document.fullscreenElement  ?? undefined
        },
        styleOverrides: {
          root: {
            border: 'red solid 2px',
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
      MuiPopper: {
        styleOverrides: {
          root: {
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