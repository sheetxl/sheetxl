import React from 'react';

import clsx from 'clsx';

import { type FloatReference } from './useFloatStack';

import styles from './FloatPopup.module.css';

/**
 * Props passed to the panel rendered inside a float.
 */
export interface FloatPopupPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  popupContainer?: HTMLElement;

  floatReference?: FloatReference;

  /**
   * When the popup panel initiates a close
   */
  closeFloat?: () => void;

  closeFloatAll?: () => void;
}

/**
 * Default popup panel (a simple flex column container).
 */
export const defaultRenderFloatPopupPanel = (props: FloatPopupPanelProps): React.ReactElement => {
  const {
    closeFloat,
    closeFloatAll,
    floatReference,
    popupContainer,
    children,
    className: propClassName,
    ...rest
  } = props;
  return (
    <div
      className={clsx('sxl-menu', styles['float-popup'], propClassName)}
      {...rest}
    >
      {children}
    </div>
  );
};
