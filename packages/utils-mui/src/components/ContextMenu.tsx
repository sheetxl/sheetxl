
import invariant from 'tiny-invariant';

import React, { memo, forwardRef, useMemo, useEffect } from 'react';

import { Theme, type SxProps } from '@mui/system';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  FloatReference, useFloatStack, type ExhibitPopupPanelProps, type ExhibitPopperProps
} from '../float';

export interface ContextMenuAttributes {
  isContextMenu: () => true;
}

export interface ContextMenuProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;

  parentFloat?: FloatReference;

  createPopupPanel?: (props: ExhibitPopupPanelProps) => React.ReactElement<any>;

  /**
   * Passed to the underlying popup panel
   */
  propsPopper?: Partial<ExhibitPopperProps>;

  /**
   * Use for float reference
   */
  label?: string;

  ref?: React.Ref<HTMLDivElement>;
}

export interface ContextMenuElement extends HTMLDivElement, ContextMenuAttributes {};


const DEFAULT_POPPER_PROPS: Partial<ExhibitPopperProps> = {
  placement: "right-start"
}


/**
 * Wraps a component to give it a context menu.
 */
// TODO - pass ref
export const ContextMenu = memo(forwardRef<ContextMenuElement, ContextMenuProps>(
  (props: ContextMenuProps, _refForward) => {
  const {
    children,
    sx: propSx,
    parentFloat,
    createPopupPanel: propCreatePopupPanel,
    propsPopper = DEFAULT_POPPER_PROPS,
    label,
    ...rest
  } = props;

  invariant(React.isValidElement(children), `Must supply a child component to enable a context menu.`);
  const childrenTyped = children as React.ReactElement<any>;

  // add on context menu here
  const localPropsChildren = useMemo(() => {
    return {
      ...childrenTyped?.props,
      ...rest,
      onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
        childrenTyped?.props?.onContextMenu?.(e);
        if (e.isDefaultPrevented()) return;
        rest?.onContextMenu?.(e);
        if (e.isDefaultPrevented()) return;
        setContextMenuEvent(e);
        e.preventDefault();
      }
    }
  }, [rest, childrenTyped?.props]);


  const createPopupPanel = useCallbackRef(propCreatePopupPanel, [propCreatePopupPanel]);
  const [contextMenuEvent, setContextMenuEvent] = React.useState<React.MouseEvent<HTMLElement>>(null);

  const {
    reference: contentMenuReference,
    component: contextMenuComponent
  } = useFloatStack({
    label: label ?? 'contextMenu',
    propsPopper,
    parentFloat,
    anchor: {
      getBoundingClientRect: () => {
        return new DOMRect(
          contextMenuEvent?.clientX || 0,
          contextMenuEvent?.clientY || 0,
          // contextMenuLocation?.clientWidth || 0,
          // contextMenuLocation?.clientHeight || 0
        );
      }
    },
    onClose: () => setContextMenuEvent(null),
    createPopupPanel
  });

  useEffect(() => {
    if (contextMenuEvent) {
      contentMenuReference.open(0);
    } else {
      contentMenuReference.close(0)
    }
  }, [contextMenuEvent]);

  return (
    <>
      {React.cloneElement(children, localPropsChildren)}
      {contextMenuComponent}
    </>
  );
}));