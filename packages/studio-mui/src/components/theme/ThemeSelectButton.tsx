
import React, { useMemo } from 'react';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';

import { ITheme, IColor } from '@sheetxl/sdk';

import {
  ExhibitIconButton, ExhibitIconButtonProps, SimpleTooltip
} from '@sheetxl/utils-mui'

import { ColorButton } from '../color';

// private
import { createLabeledColorDef } from '../color/_Utils';


export interface ThemeSelectButtonProps extends ExhibitIconButtonProps {
  docTheme: ITheme;
  onSelectTheme: (theme: ITheme) => void;
  /**
   * Determines if the button is selected or not
   * @defaultValue false
   *
   */
  isSelected?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  outlined?: boolean;
  darkMode?: boolean;
}

// TODO - move to models and rationalize with Color picker
const THEME_COLOR_DEFS:IColor.DefinitionWithLabel[] = [];
THEME_COLOR_DEFS.push(createLabeledColorDef("Primary Background", "bg1"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Primary Text", "tx1"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Secondary Background", "bg2"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Secondary Text", "tx2"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 1", "accent1"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 2", "accent2"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 3", "accent3"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 4", "accent4"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 5", "accent5"));
THEME_COLOR_DEFS.push(createLabeledColorDef("Accent 6", "accent6"));

export const ThemeSelectButton: React.FC<ThemeSelectButtonProps> = (props) => {
  const {
    docTheme,
    onSelectTheme,
    darkMode,
    isSelected,
    outlined,
    sx: propSx,
    ...rest
  } = props;

  const appTheme = useTheme();

  const colorStrip = useMemo(() => {
    let colors = [];
    for (let i=0; i<THEME_COLOR_DEFS.length; i++) {
      const colorDef = THEME_COLOR_DEFS[i];
      colors.push((
        <ColorButton
          schemeColorLookup={docTheme.schemeLookup()}
          colorDef={colorDef}
          darkMode={darkMode}
          key={ i + '-colorDef'}
          selectedColor={null}
          // swatchProps={swatchProps}
        />
      ));
    }
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flex: 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            boxShadow: (theme: Theme) => {
              return theme.shadows[2];
            }
          }}
        >
          {colors}
        </Box>
      </Box>
    )
  }, [docTheme, appTheme]);

  return (
    <ExhibitIconButton
      sx={{
        borderRadius: '2px',
        padding: '2px',
        margin: '0px 0px',
        display: 'flex',
        border: (theme: Theme) => {
          return `solid ${(isSelected ? theme.palette.text.primary : 'transparent')} 1px`
        },
        '&:hover:not([disabled])': {
          border: (theme: Theme) => {
            return `solid ${theme.palette.text.primary} 1px !important`
          }
        }
      }}
      // tooltipProps={{
      //   // description: namedStyle.name as string
      // }}
      icon={null}
      {...rest}
    >
      <Box
        sx={{
          border: (theme: Theme) => {
            return `solid ${theme.palette.divider} 1px`;
          },
          minWidth: '200px', // make this a function of something.
          borderRadius: '2px',
          padding: '4px 4px',
          textAlign: 'left',
          display: 'flex',
          gap: '4px',
          flexDirection: 'column',
          alignItems: 'stretch',
          color: (theme: Theme) => {
            return isSelected ? theme.palette.text.primary : undefined // default
          },
          '&:hover:not([disabled])': {
            color: (theme: Theme) => theme.palette.text.primary
          }
        }}
      >
        <Box
          sx={{
            // paddingBottom: '2px'
          }}
        >
          {docTheme.getName()}
        </Box>
        <Box
          sx={{
            paddingTop: '6px',
            paddingLeft: '12px',
            paddingRight: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch'
          }}
        >
          {colorStrip}
          <Box
            sx={{
              flex: '1 1 100%',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              marginTop: '2px',
              whiteSpace: 'pre',
              // color: (theme: Theme) => alpha(theme.palette.text.secondary, 1),
              fontFamily: () => {
                return docTheme.getFontScheme().getMajorFont();
              }
            }}
          >
            <SimpleTooltip
              disableInteractive
              // onClose={() => {
              //    console.log('clone tooltip'); // useful for creating breakpoint when open to see flicker associated with disabledPortal workaround
              // }}
              slotProps={{
                popper: {
                  style: {
                    pointerEvents: 'none'
                  },
                  disablePortal: true, // Tooltip is flickering very badly this is because we are usually on a popper already. This causes tooltips to not always show at bottom
                  popperOptions: {
                    strategy: 'fixed',
                    modifiers: [
                      // {
                      //   name: 'positionFixed',
                      //   enabled: true,
                      //   options: {
                      //     enabled: true
                      //   },
                      // },
                      {
                        name: 'preventOverflow',
                        enabled: true,
                        options: {
                          boundariesElement: "viewport"
                        },
                      },
                    ]
                  }
                }
              }}
              title={
                <div
                  style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'pre' }}
                >
                  {`The font used for the body.\nThe heading font is '${docTheme.getFontScheme().getMajorFont()}'.`}
                </div>
              }
              placement="bottom-start"
            >
              <div>
                {docTheme.getFontScheme().getMinorFont()}
              </div>
            </SimpleTooltip>
          </Box>
        </Box>
      </Box>
    </ExhibitIconButton>
  );
};

export default ThemeSelectButton;
