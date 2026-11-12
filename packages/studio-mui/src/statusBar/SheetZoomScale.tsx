import type React from 'react';
import {
  useRef, useState, memo, forwardRef, useEffect, useCallback
} from 'react';

import clsx from 'clsx';

import { type Theme } from '@mui/material';
import { Box, type BoxProps } from '@mui/material';
import { Slider, IconButton } from '@mui/material';

import { TimerUtils, type IWorksheetView } from '@sheetxl/sdk';

import {
  useCallbackRef, KeyCodes, useMouseDownAndHoldListener, DynamicIcon, useTranslator,
  type FloatPopperProps
} from '@sheetxl/utils-react';

import { useModelListener, useWorksheet } from '@sheetxl/react';

import { hexToRGB, SimpleTooltip } from '@sheetxl/utils-mui';

import { SheetZoomCommandButton } from '../command/SheetZoomCommandButton';

// The status bar sits at the bottom of the workbook, so the popup opens upward.
// `top-end`, not `top`: the button sits at the status bar's right edge, and the float's overflow cap
// (`size` middleware) limits the panel's max width to the room its placement leaves — centered on an
// anchor at the edge that is next to nothing, and the menu labels wrapped. End-aligned, the room is
// everything to the left.
const ZOOM_POPPER_PROPS: Partial<FloatPopperProps> = { placement: 'top-end' };

export interface SheetZoomScaleProps extends BoxProps {
  /**
   * When dragging slider.
   * @defaultValue 220
   */
  debounceDelay?: number;
  /**
   * Show the −/slider/+ trio beside the zoom percent. When omitted it hides itself on small screens
   * (below the `sm` breakpoint): a phone has pinch and the percent's menu, and the slider is a worse
   * version of the gesture that eats status-bar width.
   */
  showSlider?: boolean;
}

export const SheetZoomScale = memo(forwardRef<HTMLElement, SheetZoomScaleProps>((props: SheetZoomScaleProps, refForwarded) => {
  const {
    className,
    debounceDelay = 220,
    showSlider,
    sx: propSX,
    ...rest
  } = props;

  const t = useTranslator();
  const sheet = useWorksheet();
  const view = sheet?.getView();
  const [viewZoomScale, setViewZoomScale] = useState<number>(() => view?.getZoomScale() ?? 100);
  const [userAnimation, setUserAnimation] = useState<boolean>(false);
  /* When dragging we want to track our last drag and debounce to it. A flight of 0 means that we are not inflight */
  const refZoomInFlight = useRef<number>(0);

  // `useModelListener` tolerates an undefined source at runtime (`if (!source) return`) but its type
  // declares it non-null; bridge the possibly-undefined `view` here.
  useModelListener<IWorksheetView, IWorksheetView.IListeners>(view as IWorksheetView, {
    onZoomScaleChange:() => {
      setUserAnimation(true);
      if (refZoomInFlight.current !== 0) return;
      if (view) setViewZoomScale(view.getZoomScale());
    }
  });

  useEffect(() => {
    // We don't want to animate on load or switch tabs
    refZoomInFlight.current = 0;
    // console.log('sheet change', refZoomInFlight.current);
    setUserAnimation(false);
    setViewZoomScale(view?.getZoomScale() ?? 100);
  }, [view]);

  useEffect(() => {
    // console.log('useEffect', viewZoomScale, refZoomInFlight.current);
    if (refZoomInFlight.current === 0 || !view) return;
    TimerUtils.debounce(() => {
      if (viewZoomScale === refZoomInFlight.current) {
        // console.log('debounce set refZoomInFlight' ,0);
        refZoomInFlight.current = 0;
        view.update({
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
  }, [view]);


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
  const [relatedFocus, setRelatedFocus] = useState<HTMLElement | null>(null);
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
    if (view) handleZoomScale(zoomToScale(view.getNextZoomScale(false, 10)));
  });
  const zoomInClick = useMouseDownAndHoldListener(() => { if (view) handleZoomScale(zoomToScale(view.getNextZoomScale(true, 10))); });

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
      {/* The −/slider/+ trio. CSS-hidden (not unmounted) on small screens so the percent button keeps its
          place and nothing re-layouts on a rotate. */}
      <Box
        sx={{
          display: showSlider === undefined ? { xs: 'none', sm: 'flex' } : (showSlider ? 'flex' : 'none'),
          alignItems: 'center',
          flex: '1 1 auto',
          minWidth: 0
        }}
      >
      <SimpleTooltip
        disableInteractive
        title={t('zoom.out')}
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
            width: 4,
            borderRadius: 2,
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
          if (view) handleZoomScale(zoomToScale(view.getNextZoomScale(e.deltaY < 0, 10)));
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Down || e.which === KeyCodes.Right)) {
            if (view) handleZoomScale(zoomToScale(view.getNextZoomScale(true, 10)));
            e.preventDefault();
          } else if ((e.which === KeyCodes.Up || e.which === KeyCodes.Left)) {
            if (view) handleZoomScale(zoomToScale(view.getNextZoomScale(false, 10)));
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
          return t('zoom.sliderValue', { value: Math.round(viewZoomScale) });
        }}
      />
        <SimpleTooltip
          disableInteractive
          title={t('zoom.in')}
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
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <Box
          sx={{
            minWidth: '8px'
          }}
        />
        <SheetZoomCommandButton
          propsPopup={{ propsPopper: ZOOM_POPPER_PROPS }}
          outlined={false}
          sx={{
            padding: '0',
            '& .zoom-percent': {
              fontSize: '0.70rem',
              color: (theme: Theme) => theme.palette.text.secondary
            }
          }}
          propsButton={{ sx: { maxHeight: '22px' } }} // smaller to fit into the status bar
        />
      </Box>
    </Box>
  );
}));

SheetZoomScale.displayName = 'SheetZoomScale';