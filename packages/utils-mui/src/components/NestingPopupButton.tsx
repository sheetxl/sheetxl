import { memo, forwardRef } from 'react';

import { Box } from '@mui/material';

import { useCallbackRef } from '@sheetxl/utils-react';

import { ExhibitPopupIconButton, ExhibitPopupMenuItem, ExhibitMenuItem } from '../button';
import { PopupButtonType, type ExhibitPopupButtonProps, type ExhibitPopupPanelProps } from '../float';
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
    disabled: propDisabled,
    renderPopupPanel: propRenderPopupPanel, // what to do with this?
    ...rest
  } = props;

  const renderPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    if (!nestedChildren || nestedChildren.length === 0)
      return <></>;
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
       <ExhibitMenuItem>
        Close other children
      </ExhibitMenuItem>
      </Box>
    );
  }, [nestedChildren]);

  const localPropsButton: ExhibitPopupButtonProps = {
    disabled: propDisabled,
    renderPopupPanel,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton {...localPropsButton}/> :
    <ExhibitPopupMenuItem {...localPropsButton}/>
  );
}));
