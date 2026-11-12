import type React from 'react';
import { useMemo } from 'react';

import { type SxProps } from '@mui/system';
import { type Theme } from '@mui/material';
import { useTheme } from '@mui/material';
import { Box } from '@mui/material';

import { type ITheme } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import {
  ExhibitIconButton, SimpleTooltip, type ExhibitIconButtonProps
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
// The label is resolved per-render (see below) so it follows the active language; only the scheme
// value + its catalog key are static here.
const THEME_COLOR_SCHEME: { val: string; labelKey: string; n?: number }[] = [
  { val: "bg1", labelKey: "color.scheme.bg1" },
  { val: "tx1", labelKey: "color.scheme.tx1" },
  { val: "bg2", labelKey: "color.scheme.bg2" },
  { val: "tx2", labelKey: "color.scheme.tx2" },
  { val: "accent1", labelKey: "color.scheme.accent", n: 1 },
  { val: "accent2", labelKey: "color.scheme.accent", n: 2 },
  { val: "accent3", labelKey: "color.scheme.accent", n: 3 },
  { val: "accent4", labelKey: "color.scheme.accent", n: 4 },
  { val: "accent5", labelKey: "color.scheme.accent", n: 5 },
  { val: "accent6", labelKey: "color.scheme.accent", n: 6 },
];

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
  const t = useTranslator();

  const colorStrip = useMemo(() => {
    let colors = [];
    for (let i=0; i<THEME_COLOR_SCHEME.length; i++) {
      const scheme = THEME_COLOR_SCHEME[i];
      const colorDef = createLabeledColorDef(
        t(scheme.labelKey, scheme.n !== undefined ? { n: scheme.n } : undefined), scheme.val
      );
      colors.push((
        <ColorButton
          schemeColorLookup={docTheme.schemeLookup()}
          colorDef={colorDef}
          darkMode={darkMode}
          key={ i + '-colorDef'}
          selectedColor={null as any}
          // propsSwatch={localPropsSwatch}
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
      // propsTooltip={{
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
                  {t('theme.fontTooltip', { font: docTheme.getFontScheme().getMajorFont() })}
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
