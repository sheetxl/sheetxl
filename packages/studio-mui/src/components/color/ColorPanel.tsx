import React, {
  memo, forwardRef, useEffect, useMemo, useCallback, useState, Suspense
} from 'react';

import { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Divider } from '@mui/material';
import { Button } from '@mui/material';
import { IconButton } from '@mui/material';
import { Typography } from '@mui/material';

import { IColor, Color, ITheme, CommonUtils } from '@sheetxl/sdk';

import { useCallbackRef, DynamicIcon } from '@sheetxl/utils-react';

import { LoadingPanel } from '@sheetxl/utils-mui';

import { ColorPanelType, AutoColorPosition } from './Types';
import { ColorButton } from './ColorButton';
import { ColorButtonList } from './ColorButtonList';

import { addPreset } from './_Utils';


const CustomColorPanel = React.lazy(() => import('./CustomColorPanel'));

export interface ColorPanelProps extends React.HTMLAttributes<HTMLElement> {
  width?: number;

  /**
   * Defaults to 24px
   */
  defaultButtonSize?: number;
  // ref?: React.Ref<HTMLDivElement>;

  /**
   * Required to generate theme palettes. If not specified then DocTheme colors are used
   */
  schemeLookup?: IColor.SchemeLookup;

  recentColors?: readonly IColor[] | (() => readonly IColor[]);

  /**
   * Defaults to false
   */
  disableAlpha?: boolean;

  darkMode?: boolean;
  selectedColor: IColor;
  previewColor?: IColor;

  onSelectColor?: (color: IColor | null, isCustom: boolean) => void;
  onPreviewColor?: (color: IColor | null) => void;
  onPreviewColorImmediate?: (color: IColor | null) => void;

  previewDebounceTime?: number;
  /**
   * If autoColor is set then a special Swatch is created that will
   * use this color. When it is selected or previewed the color
   * passed will be null any consumer will then know to use the auto color
   */
  autoColor?: IColor;
  /**
   * If autoColor is specified then a label will be shown.
   * This is ignored if autoColor is not specified.
   * @defaultValue Automatic
   */
  autoColorLabel?: NonNullable<React.ReactNode>;
  /**
   * If autoColor is specified then a label will be shown.
   * This is ignored if autoColor is not specified.
   * @defaultValue AutoColorPosition.Start
   */
  autoColorPosition?: AutoColorPosition;
  /**
   * If not specified or null then this will be determined based on whether the selected color is available in the
   * presets (not include recent)
   */
  initialPanelType?: ColorPanelType;

  onEyeDropStart?: () => void;
  onEyeDropStop?: () => void;

  onDone?: () => void;
  onElementLoad?: () => void;

  /**
   * Determines if Adjustable colors with similar RGB values are considered the same.
   * @defaultValue false
   */
  compareRGB?: boolean;

}


/**
 * A color panel that has a list of presets and a way to make custom colors.
 */
export const ColorPanel = memo(forwardRef<HTMLElement, ColorPanelProps>((props, refForwarded) => {
  const {
    selectedColor = null,
    previewColor = props.selectedColor ?? null,
    recentColors: propRecentColors,
    schemeLookup: propSchemeLookup,
    disableAlpha = false,
    previewDebounceTime = 100,
    initialPanelType,
    defaultButtonSize = 24,
    width,
    onElementLoad,
    onDone,
    onEyeDropStart: propOnEyeDropStart,
    onEyeDropStop: propOnEyeDropStop,
    onPreviewColor: propOnPreviewColor,
    onPreviewColorImmediate: propOnPreviewColorImmediate,
    onSelectColor: propOnSelectColor,

    autoColor,
    autoColorLabel = "Automatic",
    autoColorPosition = AutoColorPosition.Start,
    compareRGB = false,
    darkMode = false,
    ...rest
  } = props;

  const activeColor = previewColor || selectedColor;

  const onPreviewColor = useCallbackRef(propOnPreviewColor, [propOnPreviewColor]);
  const onPreviewColorImmediate = useCallbackRef(propOnPreviewColorImmediate, [propOnPreviewColorImmediate]);
  const onSelectColor = useCallbackRef(propOnSelectColor, [propOnSelectColor]);

  const onEyeDropStart = useCallbackRef(propOnEyeDropStart, [propOnEyeDropStart]);
  const onEyeDropStop = useCallbackRef(propOnEyeDropStop, [propOnEyeDropStop]);

  const [_isEyeDropOpen, setEyeDropOpen] = useState<boolean>(false);

  const appTheme = useTheme();

  // TODO - should we make this a property and put this somewhere else? It's a bit of a hack
  // const docTheme = useContext(DocThemeContext);
  const schemeLookup = useMemo(() => {
    if (propSchemeLookup)
      return propSchemeLookup;
    // if (docTheme)
    //   return docTheme.schemeLookup;
    return Color.getDefaultSchemeLookup();
  }, [propSchemeLookup]);

  const colorPalettes = useMemo(() => {
    const mapAllPresets = new Map<string, IColor>();
    const mapAllPresetsRGB = new Map<string, IColor>();

    const primaryColors:IColor.DefinitionWithLabel[] = [];
    addPreset("Primary Background", "bg1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Primary Text", "tx1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Secondary Background", "bg2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Secondary Text", "tx2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 1", "accent1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 2", "accent2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 3", "accent3", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 4", "accent4", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 5", "accent5", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset("Accent 6", "accent6", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);

    const modifiedPresets = ITheme.buildPalette(primaryColors, schemeLookup, mapAllPresets, mapAllPresetsRGB);

    const standardColors = [];
    // Note - Office doesn't use the presets but rather the HEX
    addPreset("Dark Red", "C00000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // dkRed
    addPreset("Red", "FF0000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // red
    addPreset("Orange", "FFC000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // orange
    addPreset("Yellow", "FFFF00", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // yellow
    addPreset("Light Green", "92D050", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // ltGreen
    addPreset("Green", "00B050", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // green
    addPreset("Light Blue", "00B0F0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // ltBlue
    addPreset("Blue", "0070C0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // blue
    addPreset("Dark Blue", "002060", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // dkBlue

    // We show alpha if allowed. Note like office but 'better'.
    if (!disableAlpha) {
      addPreset("Transparent", "00000000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // transparent
    } else {
      // everyone needs an easter egg
      addPreset("Purple Is A Fruit", "7030A0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // purple. With easter egg
    }

    if (autoColor) {
      const rgbString = autoColor.toString();
      mapAllPresets.set(rgbString, autoColor);
    }

    // Note - We don't add these to presets as they may be recent custom.
    const mapRecent = new Map<string, IColor>();

    const recentColors = (typeof propRecentColors === "function") ? propRecentColors() : propRecentColors;

    const recentColorsLimited:IColor.DefinitionWithLabel[] = [];
    for (let i=0; recentColors && i<recentColors.length; i++) {
      const asKey = recentColors[i].toString();
      mapRecent.set(asKey, recentColors[i]);
      recentColorsLimited.push({
        description: 'Recent ' + (i+1),
        definition: {
          val: recentColors[i].toString()
        }
      })
    }
    return {
      primaryColors,
      modifiedPresets,
      standardColors,
      recentColorsLimited,
      mapAllPresets,
      mapAllPresetsRGB,
      mapRecent
    }
  }, [schemeLookup, propRecentColors, disableAlpha, autoColor]);

  useEffect(() => {
    onElementLoad?.();
  }, []);

  const [isCustomColors, setCustomColors] = useState<boolean>(false);
  const handleToggleCustomColors = useCallback(() => {
    setCustomColors((prev:boolean) => !prev);
  }, []);

  useEffect(() => {
    if (initialPanelType) {
      setCustomColors(initialPanelType === ColorPanelType.Custom);
    } else if (selectedColor) {
      let asKey = selectedColor.toString();
      let presetFound = colorPalettes.mapAllPresets.get(asKey);
      if (!presetFound) {
        asKey = selectedColor.toRGBA().toString();
        presetFound = colorPalettes.mapAllPresetsRGB.get(asKey);
      }
      const recentFound = colorPalettes.mapRecent.get(asKey)
      setCustomColors(!presetFound && !recentFound);
    }
  }, [selectedColor, initialPanelType]);

  const handleOnPreviewColorDebounce:(color: IColor) => void = useCallback(CommonUtils.debounce((color: IColor) => {
    onPreviewColor?.(color);
  }, previewDebounceTime), [onPreviewColor, previewDebounceTime]);

  const [currentColor, setCurrentColor] = useState<IColor>();
  useEffect(() => {
    setCurrentColor(previewColor || selectedColor);
  }, [previewColor, selectedColor]);

  const handleOnPreviewColor = useCallbackRef((color: IColor) => {
    if (!onPreviewColorImmediate) return;
    onPreviewColorImmediate(color);
    handleOnPreviewColorDebounce(color);
  }, [onPreviewColorImmediate]);

  const handleOnPreviewColorDef = useCallbackRef((colorDef: IColor.DefinitionWithLabel) => {
    handleOnPreviewColor(colorDef ? new Color({ val: colorDef.definition.val, adjs: colorDef.definition.adjs }, schemeLookup) : null);
  }, [schemeLookup]);

  const handlePresetClick = useCallback((event: React.MouseEvent<Element>) => {
    if (event.ctrlKey)
      setCustomColors(true);
  }, []);

  const handleOnSelectColor = useCallbackRef((adjustedColor: IColor) => {
    let isCustom = false;
    if (adjustedColor) {
      const asKey = adjustedColor.toString();
      isCustom = !colorPalettes.mapAllPresets.has(asKey);
    }
    onSelectColor?.(adjustedColor, isCustom);
  }, [onSelectColor, colorPalettes]);

  const handleOnSelectColorDef = useCallbackRef((colorDef: IColor.DefinitionWithLabel) => {
    const adjustedColor = colorDef ? new Color({ val: colorDef.definition.val, adjs: colorDef.definition.adjs }, schemeLookup) : null;
    Promise.resolve(onDone?.()).then(() => {
      handleOnSelectColor(adjustedColor);
    })
  }, [schemeLookup, onDone]);

  const handleCustomColorChange = useCallbackRef((customColor: string) => {
    handleOnPreviewColor(customColor ? new Color(customColor, schemeLookup) : null);
  }, [schemeLookup]);

  const eyeDropper = useMemo(() => {
    //@ts-ignore
    if (window.EyeDropper === undefined)
      return (<></>);

    const onEyeDropClick = async () => {
      setEyeDropOpen(true);
      onEyeDropStart?.();
      //@ts-ignore
      await new EyeDropper().open().then((results: any) => {
        setEyeDropOpen(false);
        onEyeDropStop?.();
        // currently no options. A ctrl/shift option would be nice
        let adjustedColor = new Color(results.sRGBHex);
        let asKey = adjustedColor.toString();
        let presetFound = colorPalettes.mapAllPresets.get(asKey);
        if (!presetFound) {
          asKey = adjustedColor.toRGBA().toString();
          presetFound = colorPalettes.mapAllPresetsRGB.get(asKey);
        }
        if (!presetFound) {
          // brute for through all colors looking for near match. We could index these using r-tree but there are less than 100
          const asRGBA = adjustedColor.toRGBA();
          const minMatchDistance = 3;
          let minFoundDistance = 255;
          colorPalettes.mapAllPresetsRGB.forEach((value: IColor, _key: string) => {
            const rgbaTest = value.toRGBA();
            // TODO - we should find a max distance in each direction
            const distance = Math.abs(rgbaTest.red - asRGBA.red) + Math.abs(rgbaTest.blue - asRGBA.blue) + Math.abs(rgbaTest.green - asRGBA.green);
            if (distance < minMatchDistance && distance < minFoundDistance )
              presetFound = value;
          });
        }
        setCustomColors(!presetFound);
        handleOnPreviewColor(presetFound || adjustedColor);
      }).catch((err:any) => {
        setEyeDropOpen(false);
        if (err?.name === 'AbortError') return; // ignore cancels
        console.error(err);
      });
    };

    return (
    <IconButton
      aria-label="eye dropper"
      size="small"
      sx={{
        color: (theme: Theme) => {
          return ((theme.palette.text as any).icon ?? theme.palette.action.active);
        },
      }}
      onClick={onEyeDropClick}
    >
      <DynamicIcon iconKey="Colorize" />
    </IconButton>
    );
  }, [colorPalettes, darkMode]);

  const customPanel = useMemo(() => {
    if (!isCustomColors)
      return;

    const fullPanelStyle:React.CSSProperties = {
      opacity: isCustomColors ? 1 : '0',
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box'
    }

    return (
      <Suspense
        fallback={
          <div style={fullPanelStyle}>
            <LoadingPanel/>
          </div>
        }
      >
        <CustomColorPanel
          style={fullPanelStyle}
          selectedColor={activeColor ? activeColor.toRGBA().toString() : 'transparent'}
          onColorChange={handleCustomColorChange}
          disableAlpha={disableAlpha}
        />
      </Suspense>
    );
  }, [isCustomColors, activeColor]);

  const swatchProps = useMemo(() => {
    return {
      onClick: handlePresetClick,
      alphaGrey: ((appTheme.palette.text as any).icon ?? appTheme.palette.action.active) // for light/dark mode
    }
  }, [handlePresetClick, appTheme]);

  const autoColorElement = useMemo(() => {
    if (!autoColor)
      return null;

    const colorDef:IColor.DefinitionWithLabel = {
      description: autoColorLabel as string,
      definition: {
        val: autoColor.getVal(),
        adjs: autoColor.getAdjustments()
      }
    };
    return (
      <>
        <MenuItem
          sx={{
            display: 'flex',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          onMouseOver={() => { handleOnPreviewColorDef(null) }}
          onClick={() => { handleOnSelectColorDef(null) }}
        >
        <Box
          sx={{
            flex: 'none',
            boxShadow: (appTheme: Theme) => {
              return appTheme.shadows[2];
            },
            borderRadius: (appTheme: Theme) => {
              return appTheme.spacing(0.5);
            },
            overflow: 'hidden'
          }}>
          <ColorButton
            schemeColorLookup={schemeLookup}
            colorDef={colorDef}
            // Override to map autoColor to null
            selectedColor={selectedColor === null ? autoColor : selectedColor}
            previewColor={previewColor === null ? autoColor : previewColor}
            defaultButtonSize={defaultButtonSize}
            isLarge={true}
            darkMode={darkMode}
            compareRGB={compareRGB}
            swatchProps={swatchProps}
          />
        </Box>
        <Typography
          noWrap={true}
          component="div"
          style={{
            display: "flex",
            flex: "1 1 100%",
            marginLeft: '8px',
            userSelect: 'none'
          }}
        >
          {autoColorLabel}
        </Typography>
        </MenuItem>
      </>
    );
  }, [autoColor, autoColorLabel, schemeLookup, selectedColor, previewColor]);

  return (
    <Box
      ref={refForwarded}
      // elevation={8}
      sx={{
        width:  width,
        outline: 'none',
        padding: '10px 10px',
        overflow: 'hidden',
        boxSizing: 'content-box'
      }}
      {...rest}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex'
        }}
      >
      <div
        style={{
          opacity: !isCustomColors ? 1 : '0'
        }}
      >
        { autoColorElement && autoColorPosition === AutoColorPosition.Start ? (<>
          { autoColorElement }
          <Divider
            light
            style={{
              marginTop: '2px',
              marginBottom: '10px'
            }}
          />
        </>) : null}
        <ColorButtonList
          title={"Theme Colors"}
          schemeColorLookup={schemeLookup}
          colorDefs={colorPalettes.primaryColors}
          selectedColor={selectedColor}
          previewColor={previewColor === undefined ? selectedColor : previewColor}
          swatchProps={swatchProps}
          onPreviewColorDef={handleOnPreviewColorDef}
          onSelectColorDef={handleOnSelectColorDef}
          compareRGB={compareRGB}
          darkMode={darkMode}
        />
        <ColorButtonList
          schemeColorLookup={schemeLookup}
          colorDefs={colorPalettes.modifiedPresets}
          selectedColor={selectedColor}
          previewColor={previewColor === undefined ? selectedColor : previewColor}
          swatchProps={swatchProps}
          onPreviewColorDef={handleOnPreviewColorDef}
          onSelectColorDef={handleOnSelectColorDef}
          compareRGB={compareRGB}
          darkMode={darkMode}
        />
        <Divider
          light
          style={{
            marginBottom: '10px'
          }}
        />
        <ColorButtonList
          title={"Standard Colors"}
          schemeColorLookup={schemeLookup}
          colorDefs={colorPalettes.standardColors}
          selectedColor={selectedColor}
          previewColor={previewColor === undefined ? selectedColor : previewColor}
          swatchProps={swatchProps}
          onPreviewColorDef={handleOnPreviewColorDef}
          onSelectColorDef={handleOnSelectColorDef}
          compareRGB={compareRGB}
          darkMode={darkMode}
        />
        <div
          style={{
            opacity: colorPalettes.recentColorsLimited.length === 0 ? '0' : undefined,
            display: colorPalettes.recentColorsLimited.length === 0 ? 'none' : undefined,
          }}
        >
          <Divider
            light
            style={{
              // marginTop: '6px',
              marginBottom: '10px'
            }}
          />
          <ColorButtonList
            title={"Recent Colors"}
            schemeColorLookup={schemeLookup}
            colorDefs={colorPalettes.recentColorsLimited}
            selectedColor={selectedColor}
            previewColor={previewColor === undefined ? selectedColor : previewColor}
            swatchProps={swatchProps}
            onPreviewColorDef={handleOnPreviewColorDef}
            onSelectColorDef={handleOnSelectColorDef}
            compareRGB={compareRGB}
            darkMode={darkMode}
          />
        </div>
        { autoColorElement && autoColorPosition === AutoColorPosition.End ? (<>
          <Divider
            light
            sx={{
              marginTop: '2px',
              marginBottom: '2px'
            }}
          />
          { autoColorElement }
          <div style={{marginBottom: '2px'}}></div>
        </>) : null}
      </div>
      {customPanel}
      </div>
      <Divider
        light
        style={{
          // marginTop: '6px',
          marginBottom: '10px'
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '8px',
          paddingLeft: '2px',
          paddingRight: '2px'
        }}
      >
        {eyeDropper}
        <div style={{
          flex: '1 1 100%',
          background: 'pink'
        }}/>
        <Button
            style={{
              minWidth: '75px',
              maxWidth: '75px'
            }}
            value="check"
            variant="outlined"
            size="small"
            onClick={() => {
              handleToggleCustomColors();
            }}
        >
          { !isCustomColors ? <div>Custom</div> : <div>Preset</div> }
        </Button>
        <Button
          variant="contained"
          size="small"
          //color="primary"
          style={{
            minWidth: '75px'
          }}
          onClick={() => {
            Promise.resolve(onDone?.()).then(() => {
              handleOnSelectColor(currentColor);
            })
          }}>
          Done
        </Button>
      </div>
    </Box>
  )
}));