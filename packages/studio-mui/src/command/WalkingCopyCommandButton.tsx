import React, { useEffect, useState, memo, forwardRef } from 'react';

import { useEditMode, type CommandButtonProps, DynamicIcon } from '@sheetxl/utils-react';

import { CommandButton } from '@sheetxl/utils-mui';

export interface WalkingCopyCommandButtonProps extends CommandButtonProps {}

export const WalkingCopyCommandButton: React.FC<WalkingCopyCommandButtonProps> = memo(
  forwardRef<any, WalkingCopyCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    ...rest
  } = props;

  // TODO - move this to Icon too
  const editModeHandler = useEditMode();
  const [isWalking, setIsWalking] = useState<boolean>(false);
  const [themedType, setThemedType] = useState<string>("info");

  useEffect(() => {
    const mode = editModeHandler.getMode();
    const newWalking = (mode?.key === 'copy' || mode?.key === 'cut');
    setIsWalking(newWalking);
    setThemedType(mode?.key === 'cut' ? "warn" : "accent");
  }, [editModeHandler]);

  return (
    <CommandButton
      ref={refForwarded}
      command={command}
      icon={
        <DynamicIcon
          iconKey="copy.walking"
          sourceProps={{
            isWalking,
            themedType: themedType
          }}
        />
      }
      {...rest}
    />
  );

}));

export default WalkingCopyCommandButton;