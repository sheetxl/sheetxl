import React, { memo, useCallback, useMemo } from 'react'

import { KeyCodes, ReactUtils } from '@sheetxl/utils-react';

import { IColor } from '@sheetxl/sdk';

import Checkboard from './Checkboard';

export interface SwatchProps extends React.HTMLAttributes<HTMLElement> {
  selectedColor: IColor;

  onSelectColor?: (color: IColor.ISpace.RGBA) => void;
  onPreviewColor?: (color: IColor.ISpace.RGBA) => void;

  alphaWhite?: string;
  alphaGrey?: string;
  alphaCheckSize?: number;
  darkMode?: boolean;
}

const Swatch: React.FC<SwatchProps> = memo((props: SwatchProps) => {
  const {
    selectedColor,
    onSelectColor,
    onPreviewColor,
    onClick,
    onKeyDown,
    onMouseOver,
    onMouseLeave,
    onFocus,
    style: propStyle = ReactUtils.EmptyCssProperties,
    children,
    alphaWhite,
    alphaGrey,
    darkMode,
    alphaCheckSize = 7,
    ...rest
  } = props;
  if (!selectedColor)
    throw new Error('a selectedColor is required');

  const handleClick = useCallback((event:React.MouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.isDefaultPrevented()) return;
    // if CTRL then do preview
    if (event.ctrlKey)
      onPreviewColor?.(selectedColor.toRGBA());
    else
      onSelectColor?.(selectedColor.toRGBA());
  }, [onSelectColor, onPreviewColor, onClick, selectedColor]);

  const handleMouseOver = useCallback((event:React.MouseEvent<HTMLElement>) => {
    onMouseOver?.(event);
    if (event.isDefaultPrevented()) return;
    onPreviewColor?.(selectedColor.toRGBA());
  }, [onPreviewColor, onMouseOver, selectedColor]);

  const handleMouseLeave = useCallback((event:React.MouseEvent<HTMLElement>) => {
    onMouseLeave?.(event);
    if (event.isDefaultPrevented()) return;
    // onPreviewColor?.(null);  // This causes navigating to custom to loose the preview which is not what we wnt
  }, [onPreviewColor, onMouseLeave]);

  const handleFocus = useCallback((event:React.FocusEvent<HTMLElement>) => {
    onFocus?.(event);
    if (event.isDefaultPrevented()) return;
    onPreviewColor?.(selectedColor.toRGBA());
  }, [onPreviewColor, onFocus, selectedColor]);

  const handleKeyDown = useCallback((event:React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.isDefaultPrevented()) return;
    if (event.keyCode === KeyCodes.Enter)
      onSelectColor?.(selectedColor.toRGBA());
  }, [onSelectColor, onKeyDown, selectedColor]);

  const checkerBoard = useMemo(() => {
    if (selectedColor.toRGBA().alpha === 1) { // checkerboard is only needed if there is some opacity
      return null;
    }
    return (
      <Checkboard
        size={alphaCheckSize}
        white={alphaWhite}
        grey={alphaGrey}
        style={{
          position: 'absolute',
          width: 'calc(100% - 1.5px)',
          height: 'calc(100% - 1.5px)',
          top: '0.75px',
          left: '0.75px'
        }}
      />
    );
  }, [alphaWhite, alphaGrey, selectedColor]);

  return (
    <div
      style={{
        position: 'absolute',
        height: '100%',
        width: '100%',
        top: '0px',
        left: '0px',
        cursor: 'pointer',
        outline: 'none',
        ...propStyle
      }}
      tabIndex={ 0 }
      {...rest}
      onClick={ handleClick }
      onKeyDown={ handleKeyDown }
      onMouseOver={ handleMouseOver }
      onMouseLeave={ handleMouseLeave }
      onFocus= { handleFocus }
    >
      {checkerBoard}
      <div
        style={{
          position: 'absolute',
          top: '0px',
          left: '0px',
          height: '100%',
          width: '100%',
          background: selectedColor.toCSS(darkMode)
        }}
      >
        { children }
      </div>
    </div>
  )
});

export default Swatch;
export { Swatch };