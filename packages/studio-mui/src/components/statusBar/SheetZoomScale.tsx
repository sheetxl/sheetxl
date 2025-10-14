import React, {
  useMemo, useRef, useState, memo, forwardRef, useEffect, useCallback
} from 'react';

import { Theme, useTheme } from '@mui/material/styles';

import clsx from 'clsx';

import { Box, BoxProps } from '@mui/material';
import { Slider } from '@mui/material';
import { Typography } from '@mui/material';
import { IconButton } from '@mui/material';

import { ISheet, IFont, CommonUtils } from '@sheetxl/sdk';

import {
  useCallbackRef, KeyCodes, useMouseDownAndHoldListener, DynamicIcon
} from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

import { hexToRGB, SimpleTooltip } from '@sheetxl/utils-mui';

export interface SheetZoomScaleProps extends BoxProps {
  /**
   * The Sheet
   */
  sheet: ISheet;

  /**
   * When dragging slider.
   * @defaultValue 220
   */
  debounceDelay?: number;
}

export const SheetZoomScale = memo(forwardRef<HTMLElement, SheetZoomScaleProps>((props: SheetZoomScaleProps, refForwarded) => {
  const {
    sheet,
    className,
    debounceDelay = 220,
    sx: propSX,
    ...rest
  } = props;

  const [viewZoomScale, setViewZoomScale] = useState<number>(() => sheet.getView().getZoomScale());
  const [userAnimation, setUserAnimation] = useState<boolean>(null);
  /* When dragging we want to track our last drag and debounce to it. A flight of 0 means that we are not inflight */
  const refZoomInFlight = useRef<number>(0);

  useModelListener<ISheet, ISheet.IListeners>(sheet, {
    onViewChange:() => {
      setUserAnimation(true);
      if (refZoomInFlight.current !== 0) return;
      setViewZoomScale(sheet.getView().getZoomScale());
    }
  });

  useEffect(() => {
    // We don't want to animate on load or switch tabs
    refZoomInFlight.current = 0;
    // console.log('sheet change', refZoomInFlight.current);
    setUserAnimation(false);
    setViewZoomScale(sheet.getView().getZoomScale());
  }, [sheet]);

  useEffect(() => {
    // console.log('useEffect', viewZoomScale, refZoomInFlight.current);
    if (refZoomInFlight.current === 0) return;
    CommonUtils.debounce(() => {
      if (viewZoomScale === refZoomInFlight.current) {
        // console.log('debounce set refZoomInFlight' ,0);
        refZoomInFlight.current = 0;
        sheet.getView().update({
          zoomScale: viewZoomScale
        });
      };
    }, debounceDelay)();
  }, [viewZoomScale, debounceDelay]);

  // Note - 100% sits in the middle but scales differently in either both direction.
  const handleZoomScale = useCallbackRef((scaled: number) => {
    let zoomScale = scaled;
    if (scaled < 100) {
      zoomScale = Math.round(scaled / (10/9) + 10);
    } else if (scaled > 100) {
      zoomScale = Math.round((3 * scaled) - 200);
    }

    refZoomInFlight.current = zoomScale;
    // console.log('handleZoomScale refZoomInFlight', refZoomInFlight.current);
    setUserAnimation(true);
    setViewZoomScale(zoomScale);
  }, [sheet]);


  const zoomToScale = (zoomScale: number) => {
    let scaled = zoomScale;
    if (zoomScale < 100) {
      scaled = (10/9) * (zoomScale - 10);
    } else if (zoomScale > 100) {
      scaled = (zoomScale + 200) / 3;
    }
    return scaled;
  }

  const scaled = zoomToScale(viewZoomScale);
  const [relatedFocus, setRelatedFocus] = useState<HTMLElement>(null);
  const refSelf = useRef<HTMLDivElement>(null);
  const focusRelated = useCallback(() => {
    const closureRelatedFocus = relatedFocus;
    if (closureRelatedFocus) {
      requestAnimationFrame(() => {
        if (refSelf.current?.contains(document.activeElement))
          closureRelatedFocus.focus();
      });
    }
  }, []);

  const zoomOutClick = useMouseDownAndHoldListener(() => {
    handleZoomScale(zoomToScale(CommonUtils.findNextStep(sheet.getView().getZoomScale(), false, 10)));
  });
  const zoomInClick = useMouseDownAndHoldListener(() => handleZoomScale(zoomToScale(CommonUtils.findNextStep(sheet.getView().getZoomScale(), true, 10))));

  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = '100%';
    return `${IFont.getSharedMeasurer()(templateString, Math.round(appTheme.typography.fontSize), appTheme.typography.fontFamily).width}px`;
  }, [appTheme]);

  return (
    <Box
      ref={refForwarded}
      className={clsx(className)}
      sx={{
        padding: '0px 0px',
        display: 'flex',
        alignItems: 'center',
        color: (theme: Theme) => theme.palette.text.secondary,
        ...propSX,
      }}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        if (e.relatedTarget && !relatedFocus) {
          setRelatedFocus(e.relatedTarget as HTMLElement);
        }
      }}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (relatedFocus && !((refSelf?.current?.contains(e.relatedTarget)))) {
          setRelatedFocus(null);
        }
      }}
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault() }}
      onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0) return; focusRelated() }}
      {...rest}
    >
      <SimpleTooltip
        disableInteractive
        title={'Zoom Out'}
      >
        <IconButton
          // disabled={disabled}
          sx={{
            padding: '0',
            "&:hover:not([disabled])": {
              color: (theme:Theme) => {
                return theme.palette.primary.main;
              }
            },
            "& svg": {
              width: '12px',
              height: '12px'
            }
          }}
          // aria-label="addTab"
          size="small"
          onPointerDown={(e: React.PointerEvent) => { if (e.button === 0) { zoomOutClick(e); return } ; e.preventDefault() }}
        >
          <DynamicIcon iconKey="Remove" />
        </IconButton>
      </SimpleTooltip>
      <Slider
        ref={refSelf}
        sx={{
          flex: '1 1 100%',
          padding: '6px 0px !important', // docsite has padding top hardcoded to 20px for @media (pointer: coarse)
          marginRight: '2px',
          marginLeft: '2px',
          // '& .MuiSlider-thumb:after': {
          //   width: '0px',
          //   height: '0px'
          // },
          '& .MuiSlider-thumb': {
            height: 14,
            width: 6,
            borderRadius: .75,
            '&.Mui-focusVisible': {
              boxShadow: (theme: Theme) => {
                return `0px 0px 0px 3px ${hexToRGB(theme.palette.primary.main, 0.16)}`;
              }
            },
            '&:focus, &:hover, &.Mui-active': {
              boxShadow: (theme: Theme) => {
                return `0px 0px 0px 2px ${hexToRGB(theme.palette.primary.main, 0.16)}`;
              }
              // TODO - Reset on touch devices, it doesn't add specificity
            },
          },
          '& .MuiSlider-mark': {
            width: '1px',
            height: '8px'
          },
          '& .MuiSlider-markActive': {
            backgroundColor: 'currentColor' // default changes color
          },
          '& .MuiSlider-thumb:not(.MuiSlider-active)': {
            transition: userAnimation ? 'left 260ms ease-in' : 'none'
          }
        }}
        valueLabelDisplay="auto"
        size="small"
        track={false}
        min={0}
        step={1}
        value={scaled}
        max={200}
        marks={[{ value: 100 }]}
        onAnimationEnd={() => setUserAnimation(false)}
        onWheel={(e: React.WheelEvent) => {
          handleZoomScale(zoomToScale(CommonUtils.findNextStep(sheet.getView().getZoomScale(), e.deltaY < 0, 10)));
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Down || e.which === KeyCodes.Right)) {
            handleZoomScale(zoomToScale(CommonUtils.findNextStep(sheet.getView().getZoomScale(), true, 10)));
            e.preventDefault();
          } else if ((e.which === KeyCodes.Up || e.which === KeyCodes.Left)) {
            handleZoomScale(zoomToScale(CommonUtils.findNextStep(sheet.getView().getZoomScale(), false, 10)));
            e.preventDefault();
          } else if ((e.which === KeyCodes.Enter || e.which === KeyCodes.Escape)) {
            // TODO - if we have a get a reference to the current grid so that we can return focus. (related is not always the correct location)
            focusRelated();
          }
        }}
        onChange={(_event: Event, newValue: number) => {
          // Snap to 100. - This should space at nicer intervals and be 'momentum based'. (timer)
          if (Math.abs(newValue - 100) < 3) {
            handleZoomScale(100);
            return;
          }
          handleZoomScale(newValue);
        }}
        valueLabelFormat={(_value: number, _index: number): React.ReactNode => {
          return `Zoom: ${Math.round(viewZoomScale)}%`;
        }}
      />
        <SimpleTooltip
          disableInteractive
          title={'Zoom In'}
        >
          <IconButton
            // disabled={disabled}
            sx={{
              padding: '0',
              "&:hover:not([disabled])": {
                color: (theme:Theme) => {
                  return theme.palette.primary.main;
                }
              },
              "& svg": {
                width: '12px',
                height: '12px'
              }
            }}
            // aria-label="addTab"
            size="small"
            onPointerDown={(e: React.PointerEvent) => { if (e.button === 0) { zoomInClick(e); return } ; e.preventDefault() }}
          >
            <DynamicIcon iconKey="Add" />
          </IconButton>
        </SimpleTooltip>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row'
        }}
      >
        <Box
          sx={{
            minWidth: '8px'
          }}
        />
        <Typography
          noWrap={true}
          component="div"
          onClick={() => {
            handleZoomScale(100);
          }}
          sx={{
            cursor: 'pointer',
            display: "flex",
            flex: "1 1 100%",
            fontSize: '0.70rem',
            marginLeft: '2px',
            marginRight: '2px',
            userSelect: 'none',
            justifyContent: 'center',
            width: defaultWidth
          }}
        >
          <div>
            {Math.round(viewZoomScale) + '%'}
          </div>
        </Typography>
      </Box>
    </Box>
  );
}));

SheetZoomScale.displayName = 'SheetZoomScale';