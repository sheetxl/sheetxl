import React, { useMemo, memo, isValidElement } from 'react'

import { ReactUtils } from '@sheetxl/utils-react';

import * as checkboard from './CheckboardUtils';

export interface CheckboardProps extends React.HTMLAttributes<HTMLElement> {
  white?: string;
  grey?: string;
  size?: number;
  borderRadius?:number;
  boxShadow?: string;

  renderers?: any;
}

const _EmptyRenderers = {};

export const Checkboard: React.FC<CheckboardProps> = memo((props:CheckboardProps) => {
  const {
    className,
    style: propStyle = ReactUtils.EmptyCssProperties,
    white='transparent',
    grey='grey',
    size=8,
    borderRadius,
    boxShadow,
    renderers=_EmptyRenderers,
    children,
    ...rest
  } = props;

  const childrenTyped = children as React.ReactElement<any>;

  const style = useMemo(() => {
    return Object.assign({
      borderRadius: borderRadius,
      boxShadow: boxShadow,
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      background: `url(${ checkboard.get(white, grey, size, renderers?.canvas) }) center left`
    }, propStyle);
  }, [white, grey, size, renderers]);

  return isValidElement(children) ? React.cloneElement(children, { ...childrenTyped.props }):<div style={style} {...rest}/>;
});
