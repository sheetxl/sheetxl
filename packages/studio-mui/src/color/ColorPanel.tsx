import type React from 'react';
import {
  memo, forwardRef, useEffect, useMemo, useCallback, useState, Suspense
} from 'react';

import { useTheme, type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { Divider } from '@mui/material';
import { Button } from '@mui/material';
import { IconButton } from '@mui/material';
import { Typography } from '@mui/material';

import { TimerUtils, defineLazyModule, messageKey } from '@sheetxl/utils';
import { type IColor, Color, ITheme } from '@sheetxl/sdk';

import { useCallbackRef, DynamicIcon, lazyComponent, useTranslator } from '@sheetxl/utils-react';

import { AnimatedLoadingPanel, LazyLoadErrorPanel } from '@sheetxl/utils-mui';

import { ColorPanelType, AutoColorPosition } from './Types';
import { ColorButton } from './ColorButton';
import { ColorButtonList } from './ColorButtonList';

import { addPreset } from './_Utils';


const CustomColorPanel = lazyComponent(
  defineLazyModule('studio:customColorPanel', () => import('./CustomColorPanel')).load,
  { renderError: ({ error }) => <LazyLoadErrorPanel error={error} /> }
);

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
  /** `null` means no color of its own — the AUTO swatch is the selected one. */
  selectedColor: IColor | null;
  previewColor?: IColor | null;

  onSelectColor?: (color: IColor | null, isCustom: boolean) => void;
  onPreviewColor?: (color: IColor | null) => void;
  onPreviewColorImmediate?: (color: IColor | null) => void;

  previewDebounceTime?: number;
  /**
   * If autoColor is set then a special Swatch is created that will
   * use this color. When it is selected or previewed the color
   * passed will be null any consumer will then know to use the auto color
   *
   * @remarks
   * `null` means there is no automatic value to offer — distinct from omitting it, which lets a
   * command's own context supply one. A picker that has already committed to a concrete fill has
   * nothing sensible to put behind an "automatic" swatch.
   */
  autoColor?: IColor | null;
  /**
   * If autoColor is specified then a label will be shown.
   * This is ignored if autoColor is not specified.
   * @defaultValue Automatic
   */
  autoColorLabel?: NonNullable<React.ReactNode>;
  /**
   * A message key for the auto-color label, resolved through this panel's own (language-subscribed)
   * translator. Prefer this over pre-resolving `autoColorLabel` upstream: a string resolved in a
   * command-group `render` callback is baked into the element once (via the module-level `t`) and can
   * freeze on its key if the pack lands after that render. `autoColorLabel` (a literal node) still wins
   * when both are given.
   */
  autoColorLabelKey?: string;
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
    autoColorLabel: propAutoColorLabel,
    autoColorLabelKey,
    autoColorPosition = AutoColorPosition.Start,
    compareRGB = false,
    darkMode = false,
    style: propStyle,
    ...rest
  } = props;

  const t = useTranslator();
  const autoColorLabel = propAutoColorLabel ?? t(autoColorLabelKey ?? messageKey('color.automatic'));

  const activeColor = previewColor || selectedColor;

  const onPreviewColor = useCallbackRef(propOnPreviewColor ?? ((_color: IColor | null) => {}), [propOnPreviewColor]);
  const onPreviewColorImmediate = useCallbackRef(propOnPreviewColorImmediate ?? ((_color: IColor | null) => {}), [propOnPreviewColorImmediate]);
  const onSelectColor = useCallbackRef(propOnSelectColor ?? ((_color: IColor | null, _isCustom: boolean) => {}), [propOnSelectColor]);

  const onEyeDropStart = useCallbackRef(propOnEyeDropStart ?? (() => {}), [propOnEyeDropStart]);
  const onEyeDropStop = useCallbackRef(propOnEyeDropStop ?? (() => {}), [propOnEyeDropStop]);

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
    addPreset(t('color.scheme.bg1'), "bg1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.tx1'), "tx1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.bg2'), "bg2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.tx2'), "tx2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 1 }), "accent1", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 2 }), "accent2", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 3 }), "accent3", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 4 }), "accent4", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 5 }), "accent5", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);
    addPreset(t('color.scheme.accent', { n: 6 }), "accent6", schemeLookup, primaryColors, mapAllPresets, mapAllPresetsRGB);

    const modifiedPresets = ITheme.buildPalette(primaryColors, schemeLookup, mapAllPresets, mapAllPresetsRGB);

    const standardColors:IColor.DefinitionWithLabel[] = [];
    // Note - Office doesn't use the presets but rather the HEX
    addPreset(t('color.standard.darkRed'), "C00000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // dkRed
    addPreset(t('color.standard.red'), "FF0000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // red
    addPreset(t('color.standard.orange'), "FFC000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // orange
    addPreset(t('color.standard.yellow'), "FFFF00", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // yellow
    addPreset(t('color.standard.lightGreen'), "92D050", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // ltGreen
    addPreset(t('color.standard.green'), "00B050", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // green
    addPreset(t('color.standard.lightBlue'), "00B0F0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // ltBlue
    addPreset(t('color.standard.blue'), "0070C0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // blue
    addPreset(t('color.standard.darkBlue'), "002060", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // dkBlue

    // We show alpha if allowed. Note like office but 'better'.
    if (!disableAlpha) {
      addPreset(t('color.standard.transparent'), "00000000", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // transparent
    } else {
      // everyone needs an easter egg
      addPreset(t('color.standard.purpleFruit'), "7030A0", schemeLookup, standardColors, mapAllPresets, mapAllPresetsRGB); // purple. With easter egg
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
        description: t('color.recent', { n: i + 1 }),
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

  const handleOnPreviewColorDebounce:(color: IColor | null) => void = useCallback(TimerUtils.debounce((color: IColor | null) => {
    onPreviewColor?.(color);
  }, previewDebounceTime), [onPreviewColor, previewDebounceTime]);

  const [currentColor, setCurrentColor] = useState<IColor | null>();
  useEffect(() => {
    setCurrentColor(previewColor || selectedColor);
  }, [previewColor, selectedColor]);

  const handleOnPreviewColor = useCallbackRef((color: IColor | null) => {
    if (!onPreviewColorImmediate) return;
    onPreviewColorImmediate(color);
    handleOnPreviewColorDebounce(color);
  }, [onPreviewColorImmediate]);

  const handleOnPreviewColorDef = useCallbackRef((colorDef: IColor.DefinitionWithLabel | null) => {
    handleOnPreviewColor(colorDef ? new Color({ val: colorDef.definition.val, adjs: colorDef.definition.adjs }, schemeLookup) : null);
  }, [schemeLookup]);

  const handlePresetClick = useCallback((event: React.MouseEvent<Element>) => {
    if (event.ctrlKey)
      setCustomColors(true);
  }, []);

  const handleOnSelectColor = useCallbackRef((adjustedColor: IColor | null) => {
    let isCustom = false;
    if (adjustedColor) {
      const asKey = adjustedColor.toString();
      isCustom = !colorPalettes.mapAllPresets.has(asKey);
    }
    onSelectColor?.(adjustedColor, isCustom);
  }, [onSelectColor, colorPalettes]);

  const handleOnSelectColorDef = useCallbackRef((colorDef: IColor.DefinitionWithLabel | null) => {
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
      aria-label={t('color.eyeDropper')}
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
            <AnimatedLoadingPanel/>
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

  const localPropsSwatch = useMemo(() => {
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
        <ListItemButton
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
            propsSwatch={localPropsSwatch}
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
        </ListItemButton>
      </>
    );
  }, [autoColor, autoColorLabel, schemeLookup, selectedColor, previewColor, darkMode, compareRGB, defaultButtonSize, localPropsSwatch]);

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
      // Applied to the panel root so a portaled consumer can re-establish the grid's `--sxl-sys-color-*`
      // (via style) — scoping `auto`/system swatches (var(--sxl-sys-color-*)) to the grid's light/dark intent.
      style={propStyle}
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
            style={{
              marginTop: '2px',
              marginBottom: '10px'
            }}
          />
        </>) : null}
        <ColorButtonList
          title={t('color.themeColors')}
          schemeColorLookup={schemeLookup}
          colorDefs={colorPalettes.primaryColors}
          selectedColor={selectedColor}
          previewColor={previewColor === undefined ? selectedColor : previewColor}
          propsSwatch={localPropsSwatch}
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
          propsSwatch={localPropsSwatch}
          onPreviewColorDef={handleOnPreviewColorDef}
          onSelectColorDef={handleOnSelectColorDef}
          compareRGB={compareRGB}
          darkMode={darkMode}
        />
        <Divider
          style={{
            marginBottom: '10px'
          }}
        />
        <ColorButtonList
          title={t('color.standardColors')}
          schemeColorLookup={schemeLookup}
          colorDefs={colorPalettes.standardColors}
          selectedColor={selectedColor}
          previewColor={previewColor === undefined ? selectedColor : previewColor}
          propsSwatch={localPropsSwatch}
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
            style={{
              // marginTop: '6px',
              marginBottom: '10px'
            }}
          />
          <ColorButtonList
            title={t('color.recentColors')}
            schemeColorLookup={schemeLookup}
            colorDefs={colorPalettes.recentColorsLimited}
            selectedColor={selectedColor}
            previewColor={previewColor === undefined ? selectedColor : previewColor}
            propsSwatch={localPropsSwatch}
            onPreviewColorDef={handleOnPreviewColorDef}
            onSelectColorDef={handleOnSelectColorDef}
            compareRGB={compareRGB}
            darkMode={darkMode}
          />
        </div>
        { autoColorElement && autoColorPosition === AutoColorPosition.End ? (<>
          <Divider
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
          gap: '8px',
          paddingLeft: '2px',
          paddingRight: '2px'
        }}
      >
        {eyeDropper}
        {/* Spacer: grows into the slack so the whitespace lands between the eye dropper and the buttons.
            flex-basis 0 (not 100%) so it never inflates the panel's shrink-to-fit width. */}
        <div style={{ flex: '1 1 0%' }}/>
        {/* Action buttons, each content-sized to its own label (not equalized — matching widths would make
            "Done" as wide as the long toggle label and push the panel wider). `flex: 0 0 auto` keeps them
            from shrinking to the 75px floor and clipping localized text. */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            gap: '8px'
          }}
        >
          <Button
              style={{ minWidth: '75px' }}
              value="check"
              variant="outlined"
              size="small"
              onClick={() => {
                handleToggleCustomColors();
              }}
          >
            {/* Overlay both labels in one grid cell so the button reserves the wider of the two and does
                not resize when toggling Custom <-> Preset. */}
            <span style={{ display: 'grid', alignItems: 'center' }}>
              <span style={{ gridArea: '1 / 1', visibility: isCustomColors ? 'hidden' : 'visible' }}>{t('color.custom')}</span>
              <span style={{ gridArea: '1 / 1', visibility: isCustomColors ? 'visible' : 'hidden' }}>{t('color.preset')}</span>
            </span>
          </Button>
          <Button
            variant="contained"
            size="small"
            //color="primary"
            style={{ minWidth: '75px' }}
            onClick={() => {
              Promise.resolve(onDone?.()).then(() => {
                handleOnSelectColor(currentColor ?? null);
              })
            }}>
            {t('color.done')}
          </Button>
        </div>
      </div>
    </Box>
  )
}));