import React, { memo, forwardRef } from 'react';

import { Box } from '@mui/material';

import { useCallbackRef } from '@sheetxl/utils-react';

import { ExhibitPopupIconButton, ExhibitPopupMenuItem, ExhibitMenuItem } from '../button';
import { ExhibitPopupButtonProps, PopupButtonType, ExhibitPopupPanelProps } from '../float';
export interface NestingPopupButtonProps extends ExhibitPopupButtonProps {
  nestedChildren?: NestingPopupButtonProps[]; // TODO -  | (currentNode: NestedNode) => NestedNode[]
  /**
   * Rendering styles
   * @defaultValue to Toolbar
   */
  variant?:PopupButtonType;
}

export const NestingPopupButton = memo(
  forwardRef<HTMLElement, NestingPopupButtonProps>((props, refForwarded) => {
  const {
    nestedChildren,
    variant,
    disabled: propDisabled = false,
    createPopupPanel: propCreatePopupPanel, // what to do with this?
    ...rest
  } = props;

  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    if (!nestedChildren || nestedChildren.length === 0)
      return null;
    const {
      popupContainer,
      floatReference,
      ref,
      ...rest
    } = props;

    const nestedChildrenElements  = [];
    for (let i=0;i<nestedChildren.length; i++) {
      const nestedChildNode = nestedChildren[i] as any;
      if (!nestedChildNode) continue;
      nestedChildrenElements.push(
        <NestingPopupButton
          key={i}
          parentFloat={floatReference}
          {...rest}
          {...nestedChildNode}
        />
      );
    }

    return (
      <Box
        ref={refForwarded}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '4px', // TODO - size of rounded border from theme
          paddingBottom: '4px', // TODO - size of rounded border from theme
        }}
      >
        Children here
       {nestedChildrenElements}
       <ExhibitMenuItem
          parentFloat={floatReference}
        >
        Close other children
      </ExhibitMenuItem>
      </Box>
    );
  }, [nestedChildren]);

  const buttonProps: ExhibitPopupButtonProps = {
    disabled: propDisabled,
    createPopupPanel,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton {...buttonProps}/> :
    <ExhibitPopupMenuItem {...buttonProps}/>
  );
}));
