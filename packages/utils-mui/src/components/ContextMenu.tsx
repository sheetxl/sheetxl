import type React from 'react';
import {
  memo, forwardRef, useMemo, useEffect, useState, cloneElement, isValidElement
} from 'react';

import { type Theme, type SxProps } from '@mui/system';

import {
  useCallbackRef, useFloatStack, type FloatReference, type FloatPopperProps, type RenderSlotFn
} from '@sheetxl/utils-react';

import {
  type ExhibitPopupPanelProps
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

  renderPopupPanel?: RenderSlotFn<ExhibitPopupPanelProps>;

  /**
   * Passed to the underlying popup panel
   */
  propsPopper?: Partial<FloatPopperProps>;

  /**
   * Use for float reference
   */
  label?: string;

  ref?: React.Ref<HTMLDivElement>;
}

export interface ContextMenuElement extends HTMLDivElement, ContextMenuAttributes {};


const DEFAULT_POPPER_PROPS: Partial<FloatPopperProps> = {
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
    renderPopupPanel: propRenderPopupPanel,
    propsPopper = DEFAULT_POPPER_PROPS,
    label,
    ...rest
  } = props;

  if (!isValidElement(children)) throw new Error(`Must supply a child component to enable a context menu.`);
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


  const renderPopupPanel = useCallbackRef(propRenderPopupPanel ?? (() => undefined), [propRenderPopupPanel]);
  const [contextMenuEvent, setContextMenuEvent] = useState<React.MouseEvent<HTMLElement> | null>(null);

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
    renderPopupPanel
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
      {cloneElement(children, localPropsChildren)}
      {contextMenuComponent}
    </>
  );
}));