import React from 'react';

import clsx from 'clsx';


const _EmptyProps: React.HTMLAttributes<HTMLElement> = {};

export interface SplitPaneResizerProps extends React.HTMLAttributes<HTMLDivElement>, React.Attributes {
  splitDirection?: 'row' | 'column';
  disabled?: boolean;

  paddingBefore?: number;
  paddingAfter?: number;
  propsHitArea?: React.HTMLAttributes<HTMLDivElement>;

  ref?: React.Ref<HTMLDivElement>;
}

export const SplitPaneResizer = (props: SplitPaneResizerProps): React.ReactElement => {
  const {
    onPointerDown,
    style: propStyle,
    splitDirection,
    paddingBefore = 0,
    paddingAfter = 0,
    disabled,
    key,
    propsHitArea = _EmptyProps,
    ...rest
  } = props;

  const isRowDirection = splitDirection === 'row';
  const {
    style: propHitAreaStyle,
    className: propHitAreaClassName,
    ...hitAreaRest
  } = propsHitArea;

  return (
    <div
      style={{
        ...propStyle,
        position: 'relative'
      }}
      key={key}
      {...rest}
    >
    <div
      className={clsx('hit-box', propHitAreaClassName)}
      style={{
        left: `${isRowDirection ? -paddingBefore : 0}px`,
        width: `calc(100% + ${isRowDirection ? (paddingBefore + paddingAfter) : 0}px)`,
        top: `${!isRowDirection ? -paddingBefore : 0}px`,
        height: `calc(100% + ${!isRowDirection ? (paddingBefore + paddingAfter) : 0}px)`,
        position: 'absolute',
        ...propHitAreaStyle
      }}
      onPointerDown={disabled ? undefined : onPointerDown}
      {...hitAreaRest}
    />
  </div>
  )
}