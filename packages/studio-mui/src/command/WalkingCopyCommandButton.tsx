import type React from 'react';
import { useEffect, useState, memo, forwardRef } from 'react';

import { useEditMode, DynamicIcon, type CommandButtonProps } from '@sheetxl/utils-react';

import { CommandButton } from '@sheetxl/utils-mui';

export interface WalkingCopyCommandButtonProps extends CommandButtonProps {}

export const WalkingCopyCommandButton: React.FC<WalkingCopyCommandButtonProps> = memo(
  forwardRef<any, WalkingCopyCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    ...rest
  } = props;

  const editModeHandler = useEditMode();
  const [isWalking, setIsWalking] = useState<boolean>(false);
  const [themedType, setThemedType] = useState<string>('primary');

  useEffect(() => {
    const mode = editModeHandler.getMode();
    const newWalking = (mode?.key === 'copy' || mode?.key === 'cut');
    setIsWalking(newWalking);
    setThemedType(mode?.key === 'cut' ? 'warning' : 'primary');
  }, [editModeHandler]);

  return (
    <CommandButton
      ref={refForwarded}
      commandKey={commandKey}
      icon={
        <DynamicIcon
          iconKey="copy.walking"
          propsSource={{
            isWalking,
            themedType: themedType
          }}
        />
      }
      {...rest}
    />
  );
}));