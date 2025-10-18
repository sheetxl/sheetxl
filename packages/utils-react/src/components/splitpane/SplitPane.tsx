import React, { useEffect, useMemo, memo, forwardRef, useRef, useState } from 'react';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';
import { useMeasure } from 'react-use';

import { useImperativeElement } from '../../hooks/useImperativeElement';
import { useCallbackRef } from '../../hooks/useCallbackRef';

import { type SplitPaneResizerProps, SplitPaneResizer } from './SplitPaneResizer';

export interface SplitPaneAttributes {
  /**
   * Programmatic api to set the position. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   * @param position - Pixels as `string` or a percent as a `number`.
   */
  setPosition: (position: string | number) => void;
  isSplitPane: () => true;
}

export interface ISplitPaneElement extends HTMLDivElement, SplitPaneAttributes {};

export interface SplitPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The elementBefore the divider.
   */
  elementBefore?: React.ReactElement<any>;
  /**
   * The element after the divider.
   */
  elementAfter?: React.ReactElement<any>;
  /**
   * If the fixedPane is set resizing will keep one the sizes.
   *
   * @remarks
   * When set the default position to be interpreted as pixels.
   */
  fixedPane?: 'before' | 'after'| null;
  /**
   * The position. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   */
  position?: number | string;
  /**
   * The minimum size. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   */
  minBefore?: number | string;
  /**
   * The minimum size. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   */
  maxBefore?: number | string;
  /**
   * The minimum size. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   */
  minAfter?: number | string;
  /**
   * The minimum size. Can be either a string with px or %.
   * If it is a number it will be interpreted based on whether there is a fixed pane or not.
   */
  maxAfter?: number | string;
  /**
   * When the position has been changed.
   * @remarks This is not fired during drag.
   * @param position
   */
  onPositionChange?: (position: { pixels: number, percent: number }) => void;
  /**
   * Determine the direction of the scrollPane
   */
  splitDirection?: 'row' | 'column';
  disabled?: boolean;

  propsResizer?: SplitPaneResizerProps;
  propsPane?: React.HTMLAttributes<HTMLElement>;
  propsPaneBefore?: React.HTMLAttributes<HTMLElement>;
  propsPaneAfter?: React.HTMLAttributes<HTMLElement>;

  onDragStart?: () => void;
  onDragResize?: (position: number) => void;
  onDragFinish?: (position: number) => void;

  renderResizer?: (props: SplitPaneResizerProps) => React.ReactElement;

  /**
   * A ref that points to the HTMLDivElement.
   */
  ref?: React.Ref<ISplitPaneElement>;
}

const _EmptyProps: React.HTMLAttributes<HTMLElement> = {};


interface CalcedDimension {

  percents: number[];
  pixels: number[];

  // position: CalcedSize;
  minBefore: string;
  maxBefore: string;
  minAfter: string;
  maxAfter: string;
};

interface CalcedSize {
  pixels: number;
  percent: number;
};

interface CalcedLimits {
  fixedPaneOffset: number;
  minBefore: CalcedSize;
  maxBefore: CalcedSize;
  minAfter: CalcedSize;
  maxAfter: CalcedSize;
};

const toPixels = (size: CalcedSize, totalSize: number, isBefore: boolean=true): number => {
  if (size === null) return null;
  if (size.pixels !== null)
    return (isBefore ? size.pixels : totalSize - size.pixels);
  return (isBefore ? size.percent : 100 - size.percent) / 100 * totalSize;
}

const toCssString = (size: CalcedSize, isBefore: boolean=true): string => {
  if (size?.percent) return `${isBefore ? size.percent : 100 - size.percent}%`;
  if (size?.pixels) return `${size.pixels}px`;
  return undefined;
}
const parseCalcSize = (size: number | string, isDefaultPercent: boolean): CalcedSize => {
  if (size === null || size === undefined) return null;
  const retValue:CalcedSize = {
    percent: null,
    pixels: null
  }

  let isPercent = isDefaultPercent;
  if (typeof size === 'string') {
    size = size.trim().toLowerCase();
    if (size.endsWith('px')) {
      size = size.substring(0, size.length-2);
      isPercent = false;
    } else if (size.endsWith('%')) {
      size = size.substring(0, size.length-1);
      isPercent = true;
    }
    size = parseFloat(size);
  }
  if (isPercent) {
    retValue.percent = size;
  } else {
    retValue.pixels = size;
  }
  return Object.freeze(retValue);
}

/* Given the width and the height determine panel layouts */
const calcDimensions = (
  position: CalcedSize,
  containerSize: number,
  resizerSize: number,
  limits: CalcedLimits,
): CalcedDimension => {
  const pixels = [null, null];
  const percents = [null, null];

  if (!position) {
    position = {
      percent: limits.fixedPaneOffset === null ? 50 : null,
      pixels: limits.fixedPaneOffset === null ? null : 0
    };
  }

  if (containerSize === 0) { // we haven't realized yet just just return defaults
    if (position?.pixels !== undefined && position?.pixels !== null) {
      if (limits.fixedPaneOffset !== 1) {
        pixels[0] = position?.pixels;
        percents[1] = 100;
      } else {
        pixels[1] = position?.pixels - resizerSize;
        percents[0] = 100;
      }
    } else if (position?.percent !== undefined && position?.percent !== null) {
      if (limits.fixedPaneOffset !== 1) {
        percents[0] = position?.percent;
        percents[1] = 100 - position?.percent;
      } else {
        percents[1] = position?.percent;
        percents[0] = 100 - position?.percent;
      }
    }
    return {
      percents,
      pixels,
      minBefore: toCssString(limits.minBefore, true),
      maxBefore: toCssString(limits.maxBefore, true),
      minAfter: toCssString(limits.minAfter),
      maxAfter: toCssString(limits.maxAfter),
    };
  }
  let positionPx = toPixels(position, containerSize, limits.fixedPaneOffset !== 1);
  let panesSize = containerSize - resizerSize;

  let minBeforePx = toPixels(limits.minBefore, panesSize, true) ?? 0;
  let maxBeforePx = toPixels(limits.maxBefore, panesSize, true) ?? panesSize;

  let minAfterPx = 0;
  let maxAfterPx = 0;
  let min = 0;
  let max = panesSize;

  /*
   * We reverse these because we spec the contains as relative to the pane
   */
  minAfterPx = (toPixels(limits.maxAfter, containerSize, false) ?? resizerSize) - resizerSize; // subtract resizer & opposite direction
  maxAfterPx = (toPixels(limits.minAfter, containerSize, false) ?? containerSize); // subtract resizer & opposite direction
  min = Math.max(minBeforePx, minAfterPx);
  max = Math.min(maxBeforePx, maxAfterPx);
  positionPx = Math.max(min, Math.min(positionPx, max));

  maxAfterPx = Math.min(panesSize - positionPx, (toPixels(limits.maxAfter, panesSize - positionPx, true) ?? panesSize));
  minAfterPx = Math.min(panesSize - positionPx, (toPixels(limits.minAfter, panesSize - positionPx, true) ?? panesSize));

  pixels[0] = positionPx;
  pixels[1] = panesSize-pixels[0];

  const positionPercent = Math.max(0, Math.min(100, positionPx / panesSize * 100));
  percents[0] = positionPercent;
  percents[1] = 100-percents[0];
  return {
    percents,
    pixels,
    minBefore: `${minBeforePx}px`,
    minAfter: `${minAfterPx}px`,
    // maxBefore: `${maxBeforePx}px`,
    // maxAfter: `${maxAfterPx}px`,
    maxBefore: `${pixels[0]}px`, // We do this because we don't want the splitPane to size beyond it's container
    maxAfter: `${pixels[1]}px`, // We do this because we don't want the splitPane to size beyond it's container
  };
}

/**
 * SplitPane
 * A component can have two children and will add a resizer between the two.
 * @remarks
 *
 * Because this component measures the elements (both panes and the resizer) it is important
 * that none of these have margins or paddings. If these are required then use a nested element.
 */
export const SplitPane = memo(forwardRef<ISplitPaneElement, SplitPaneProps>(
  (props: SplitPaneProps, refForwarded) => {
    const {
      elementBefore,
      elementAfter,

      splitDirection = 'row',
      fixedPane: propFixedPane = null, /* proportional */
      position: propPosition = undefined,
      onPositionChange: propOnPositionChange,
      minBefore,
      maxBefore,
      minAfter,
      maxAfter,

      children,

      className: propClassName,
      style: propStyle,

      disabled = false,

      onDragStart: propOnDragStart,
      onDragResize: propOnDragResize,
      onDragFinish: propOnDragFinish,

      propsResizer = _EmptyProps,
      propsPane = _EmptyProps,
      propsPaneBefore = _EmptyProps,
      propsPaneAfter = _EmptyProps,
      renderResizer = SplitPaneResizer,
    } = props;
    if (children) {
      throw new Error('Use elementBefore and elementAfter instead of children.');
    }

    const isDoubleElement = useMemo(() => {
      return React.isValidElement(elementAfter) && React.isValidElement(elementBefore);
    }, [elementAfter, elementBefore]);

    const limits:CalcedLimits = useMemo(() => {
      let fixedPaneOffset:number|null = null; // null, 0 before, 1 after
      if (propFixedPane) {
        if (propFixedPane === 'before') {
          fixedPaneOffset = 0;
        } else if (propFixedPane === 'after') {
          fixedPaneOffset = 1;
        }
      }
      const isPercent = fixedPaneOffset === null;
      return {
        fixedPaneOffset,
        isPercent,
        minBefore: parseCalcSize(minBefore, isPercent),
        maxBefore: parseCalcSize(maxBefore, isPercent),
        minAfter: parseCalcSize(minAfter, isPercent),
        maxAfter: parseCalcSize(maxAfter, isPercent)
      }
    }, [minBefore, maxBefore, minAfter, maxAfter]);

    const onPositionChange = useCallbackRef(propOnPositionChange, [propOnPositionChange]);
    const [position, setPosition] = useState<CalcedSize>(() => parseCalcSize(propPosition, propFixedPane === null));
    useEffect(() => {
      setPosition(parseCalcSize(propPosition, propFixedPane === null));
    }, [propPosition, propFixedPane]);

    const [refMeasureTotal, { width: widthTotal, height: heightTotal }] = useMeasure<HTMLDivElement>();
    const [refMeasureResizer, { width: widthResizer, height: heightResizer }] = useMeasure<HTMLDivElement>();
    const resizerLength = splitDirection === 'row' ? widthResizer : heightResizer;
    const totalLength = splitDirection === 'row' ? widthTotal : heightTotal;

    const dimensions = useMemo(() => {
      return calcDimensions(
        position,
        totalLength,
        resizerLength,
        limits
      );
    }, [limits, position, totalLength, resizerLength, splitDirection]);

    const [isDragging, setDragging] = useState<boolean>(false);
    const onDragStart = useCallbackRef(propOnDragStart, [propOnDragStart]);
    const onDragResize = useCallbackRef(propOnDragResize, [propOnDragResize]);
    const onDragFinish = useCallbackRef(propOnDragFinish, [propOnDragFinish]);

    const refPaneBefore = useRef(null); // not in use
    const refResizer = useRef(null); // not in use
    const refPaneAfter = useRef(null); // not in use

    const {
      style: paneStyle,
      className: paneClassName,
      ...restPropsPane
    } = propsPane;

    const defaultPaneStyle: React.CSSProperties & { widthResizer: string } = {
      minWidth: 0,
      minHeight: 0,
      maxWidth: '100%',
      maxHeight: '100%',
      height: '100%',
      widthResizer: '100%',
      display: 'flex',
      overflow: 'hidden',
      position: 'relative',
      ...paneStyle,
    }

    const {
      className: paneClassNameBefore,
      style: paneStyleBefore,
      ...paneRestBefore
    } = propsPaneBefore;

    const {
      className: paneClassNameAfter,
      style: paneStyleAfter,
      ...paneRestAfter
    } = propsPaneAfter;

    const style:React.CSSProperties = {
      flex: '1 1 100%',
      width: '100%',
      ...propStyle,
      flexDirection: splitDirection,
      display: 'flex', // required to work
    };

    const {
      className: resizerClassName,
      style: resizerStyle,
      onPointerDown: onResizerPointerDown,
      ...restResizer
    } = propsResizer;

    const handleSetPosition = useCallbackRef((position: string | number): void => {
      const calcSize = parseCalcSize(position, propFixedPane === null)
      setPosition(calcSize);
    }, [propFixedPane]);

    const handlePointerMove = useCallbackRef((event: globalThis.PointerEvent) => {
      if (disabled || !isDragging) return;
      const rect = refLocal.current?.getBoundingClientRect();
      let pixels = 0;
      if (splitDirection === 'row') {
        pixels = (event.clientX ?? (event as any).touches?.[0]?.clientX) - rect.x;
      } else {
        pixels = (event.clientY ?? (event as any).touches?.[0]?.clientY) - rect.y;
      }
      pixels = Math.max(0, Math.min(totalLength, pixels));
      if (limits.fixedPaneOffset === 1) {
        pixels = totalLength - pixels;
      }
      if (!propPosition || position.pixels !== pixels) {
        setPosition({
          pixels,
          percent: null
        });
      }

      onDragResize?.(pixels);
      event.stopPropagation();
      event.preventDefault();
    }, [limits, splitDirection, disabled, isDragging, position, totalLength]);

    const handlePointerUp = useCallbackRef((event: globalThis.PointerEvent) => {
      document.removeEventListener(`pointermove`, handlePointerMove);
      document.removeEventListener(`touchmove`, handlePointerMove);
      document.removeEventListener(`pointerup`, handlePointerUp);

      if (!isDragging) return;
      setDragging(false);

      if (!position) return; // Never changed
      onDragFinish(position.pixels);
      const propCalcSize = parseCalcSize(propPosition, propFixedPane === null);
      if (!propCalcSize || position.pixels !== propPosition) {
        const eventPosition = {
          ...position
        }
        if (eventPosition.percent === null) {
          eventPosition.percent = eventPosition.pixels / totalLength * 100;
        }
        onPositionChange(eventPosition);
      }
      event.stopPropagation();
      event.preventDefault();
    }, [position, isDragging, propPosition, propFixedPane, totalLength]);

    const handlePointerDown = useCallbackRef((event: React.PointerEvent<HTMLElement>) => {
      onResizerPointerDown?.(event);
      if (event.defaultPrevented) return;
      if (disabled) return;
      if (isDragging) return;
      setDragging(true);
      onDragStart();

      document.addEventListener(`pointermove`, handlePointerMove, { passive: false });
      document.addEventListener(`touchmove`, handlePointerMove, { passive: false });
      document.addEventListener(`pointerup`, handlePointerUp, { passive: false });
    }, [onResizerPointerDown]);

    const refLocal = useImperativeElement<ISplitPaneElement, SplitPaneAttributes>(refForwarded, () => {
      return {
        setPosition: handleSetPosition,
        isSplitPane: () => true
      }
    }, []);

    const resizer = useMemo(() => {
      if (!isDoubleElement) return null;
      return renderResizer?.({
        key: "resizer",
        ref: mergeRefs([refMeasureResizer, refResizer]),
        className: clsx('resizer', resizerClassName),
        onPointerDownCapture: handlePointerDown,
        style: {
          cursor: !disabled ? splitDirection === 'row' ? 'ew-resize' : 'ns-resize' : undefined,
          minWidth: splitDirection === 'row' ? '2px' : undefined,
          minHeight: splitDirection !== 'row' ? '2px' : undefined,
          boxSizing: 'border-box',
          pointerEvents: 'all',
          zIndex: 1,
          ...resizerStyle,
        },
        splitDirection,
        disabled,
        ...restResizer
      })
    }, [isDoubleElement, resizerClassName, restResizer, splitDirection, resizerStyle, disabled]);

    const sizeDim = splitDirection === 'row' ? 'Width' : 'Height';
    const paneBefore = useMemo(() => {
      if (!elementBefore) return null;
      const stylePaneBefore = {
        ...defaultPaneStyle,
        ...paneStyleBefore,
        flex: (limits.fixedPaneOffset === 0 && dimensions?.pixels[0] !== null) ? `0 0 ${Math.round(dimensions?.pixels[0])}px` : `1 1 ${Math.round(dimensions?.percents[0] ?? 100)}%`,
        [`min${sizeDim}`]: dimensions?.minBefore,
        [`max${sizeDim}`]: elementAfter ? dimensions?.maxBefore : '100%'
      }

      return (
        <div
          key="before"
          ref={refPaneBefore}
          className={clsx('before', paneClassName, paneClassNameBefore)}
          style={stylePaneBefore}
          {...restPropsPane}
          {...paneRestBefore}
        >
          {elementBefore}
        </div>
      );
    }, [elementBefore, propsPane, propsPaneBefore, limits, dimensions]);

    const paneAfter = useMemo(() => {
      if (!elementAfter) return null;
      const stylePaneAfter = {
        ...defaultPaneStyle,
        ...paneStyleAfter,
        flex: (limits.fixedPaneOffset === 1 && dimensions?.pixels[1] !== null) ? `0 0 ${Math.round(dimensions?.pixels[1])}px` : `1 1 ${Math.round(dimensions?.percents[1] ?? 100)}%`,
        [`min${sizeDim}`]: dimensions?.minAfter,
        [`max${sizeDim}`]: elementBefore ? dimensions?.maxAfter : '100%',
      }

      return (
        <div
          key="after"
          ref={refPaneAfter}
          className={clsx('after', paneClassName, paneClassNameAfter)}
          style={stylePaneAfter}
          {...restPropsPane}
          {...paneRestAfter}
        >
          {elementAfter}
        </div>
      );
    }, [elementAfter, propsPane, propsPaneAfter, limits, dimensions]);

    return (
      <div
        ref={mergeRefs([refMeasureTotal, refLocal])}
        className={
          clsx(
            'splitPane',
            splitDirection === 'row' ? 'vertical' : 'horizontal', {
              'dragging': isDragging,
            },
            propClassName
          )
        }
        style={style}
      >
        {paneBefore}
        {resizer}
        {paneAfter}
      </div>
    );
  }
));

SplitPane.displayName = 'SplitPane';