import React, {
  useState, useCallback, useLayoutEffect, memo
} from 'react';

import { Theme, useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import tinycolor from 'tinycolor2';

import { Hue, Alpha } from 'react-color/es/components/common';
import SketchFields from 'react-color/es/components/sketch/SketchFields';
import { Saturation } from './Saturation';

import { ReactUtils } from '@sheetxl/utils-react';

import { Checkboard } from './Checkboard';

/**
 * A set of ColorSpace from tinycolor
 */
interface ColorSpace {
  hsl: any;
  hex: any;
  rgb: any;
  hsv: any;
  source: any;
}

export const toState = (data:ColorSpace | string, oldHue:number=null) => {
  const color = (data as ColorSpace).hex ? tinycolor((data as ColorSpace).hex) : tinycolor((data as string) || 'transparent');
  const hsl = color.toHsl();
  const hsv = color.toHsv();
  const rgb = color.toRgb();
  const hex = color.toHex();
  if (hsl.s === 0) {
    hsl.h = oldHue ?? 0;
    hsv.h = oldHue ?? 0;
  }

  return {
    hsl: hsl,
    hex: '#' + hex,
    rgb: rgb,
    hsv: hsv,
    source: (data as ColorSpace).source
  };
};

/**
 * This is a standard color panel.
 */
export interface CustomColorPanelProps extends React.HTMLAttributes<HTMLElement> {
  selectedColor: string;
  onColorChange: (color: string) => void;

  /**
   * Defaults to false
   */
  disableAlpha?: boolean;
  renderers?: any; // TODO - type properly
}

export const CustomColorPanel: React.FC<CustomColorPanelProps> = memo((props:CustomColorPanelProps) => {
  const {
    selectedColor,
    onColorChange,
    renderers,
    disableAlpha = false,
    style: propStyle = ReactUtils.EmptyCssProperties,
    ...rest
  } = props;

  const appTheme = useTheme();

  const [colorSpaces, setColorSpace] = useState<ColorSpace>(() => toState(selectedColor));
  // When adjusting saturation we need to separately tack the original state to put it back
  const [hue, setHue] = useState<number>(colorSpaces.hsl.h ?? 0);

  const updateColorSpace = useCallback((newValue: ColorSpace | string): ColorSpace => {
    let updatedState = toState(newValue, hue);
    setHue(updatedState.hsl.h ?? 0);
    setColorSpace(updatedState);
    return updatedState;
  }, [hue]);

  const onMergeColorChange = useCallback((newState: ColorSpace | string): void => {
    const updatedState = updateColorSpace(newState);
    // If disabled alpha we always return alpha 1 regardless of input
    const asStaticColor = `rgba(${updatedState.rgb.r},${updatedState.rgb.g},${updatedState.rgb.b},${disableAlpha ? 1 : updatedState.rgb.a})`;
    onColorChange?.(asStaticColor);
  }, [onColorChange, updateColorSpace, disableAlpha]);

  useLayoutEffect(() => {
    updateColorSpace(selectedColor);
  }, [selectedColor, updateColorSpace]);

  const alphaElement = (
    <div
      style={{
        position: 'relative',
        minHeight: '10px',
        maxHeight: '10px',
        width: '100%'
      }}
    >
      <Alpha
        style={{
          radius: '2px',
          shadow: 'inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)',
        }}
        rgb={ colorSpaces.rgb }
        hsl={ colorSpaces.hsl }
        renderers={ renderers }
        onChange={ onMergeColorChange }
      />
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...propStyle
      }}
      {...rest}
    >
       <div
          style={{
            width: '100%',
            flex: '1 1 100%',
            position: 'relative',
            overflow: 'hidden',
            //cursor: 'crosshair important'
          }}
        >
        <Saturation
          style={{
            borderRadius: '3px',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)',
          }}
          hsl={ colorSpaces.hsl }
          hsv={ colorSpaces.hsv }
          onChange={ onMergeColorChange }
        />
      </div>
      <div // control
        style={{
          marginTop: '4px',
          display: 'flex',
          gap: '4px'
        }}
      >
        <div
          style={{
            flex: '1',
            // gap: '4px',
            display: 'flex',
            flexDirection: disableAlpha ? 'row' : 'column',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
              minHeight: '10px',
              maxHeight: '10px',
              width: '100%'
            }}
          >
            <Hue
              style={{
                radius: '2px',
                shadow: 'inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)',
              }}
              hsl={ colorSpaces.hsl }
              onChange={ onMergeColorChange }
            />
          </div>
          { disableAlpha ? null : alphaElement}
        </div>
        <div
          style={{
            minWidth: '24px',
            maxWidth: '24px',
            minHeight: '24px',
            maxHeight: '24px',
            position: 'relative',
            borderRadius: '1px',
            overflow: 'hidden'
          }}
        >
          <Checkboard
            grey={((appTheme.palette.text as any).icon ?? appTheme.palette.action.active)}
          />
          <div
            style={{
              position: 'absolute',
              height: '100%',
              width: '100%',
              background: `rgba(${colorSpaces.rgb.r},${colorSpaces.rgb.g},${colorSpaces.rgb.b},${disableAlpha ? 1 : colorSpaces.rgb.a})`,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15), inset 0 0 4px rgba(0,0,0,.25)',
            }}
          />
        </div>
      </div>
      <Box
        sx={{
          marginBottom: '4px',
          '& label': {
             fontFamily: (theme: Theme) => {
              return `${theme.typography.fontFamily} !important`;
             },
             color: (theme: Theme) => {
              return `${theme.palette.text.secondary} !important`;
            }
          },
          '& *': {
             fontFamily: (theme: Theme) => {
              return `${theme.typography.fontFamily} !important`;
             },
             'userSelect' : 'none'
          },
          '& input': {
            paddingLeft: (theme: Theme) => {
              return `${theme.spacing(0.5)} !important`;
            },
            paddingRight: (theme: Theme) => {
              return `${theme.spacing(0.5)} !important`;
            },
            outline: 'none',
            // borderRadius: (theme: Theme) => {
            //   return `${theme.spacing(0.5)}px !important`;
            // },
            // border: 'red solid 1px !important',
            boxSizing: 'border-box',
            width: '100% !important',
            textAlign: 'center'
          }
        }}
      >
        <SketchFields
          rgb={ colorSpaces.rgb }
          hsl={ colorSpaces.hsl }
          hex={ colorSpaces.hex }
          disableAlpha={ disableAlpha }
          onChange={ onMergeColorChange }
        />
      </Box>
    </div>
  );
});

export default CustomColorPanel;