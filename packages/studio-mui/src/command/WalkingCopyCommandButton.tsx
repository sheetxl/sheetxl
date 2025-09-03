import React, { useEffect, useState, memo, forwardRef } from 'react';

import { useEditMode } from '@sheetxl/utils-react';

import { CommandButton, CommandButtonProps } from '@sheetxl/utils-mui';
import { WalkingCopyIcon, themeIcon } from '@sheetxl/utils-mui';

export interface WalkingCopyCommandButtonProps extends CommandButtonProps {}

export const WalkingCopyCommandButton: React.FC<WalkingCopyCommandButtonProps> = memo(
  forwardRef<any, WalkingCopyCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    ...rest
  } = props;

  const editModeHandler = useEditMode();
  const [isWalking, setIsWalking] = useState<boolean>(false);
  const [themedType, setThemedType] = useState<string>("info");

  useEffect(() => {
    const mode = editModeHandler.getMode();
    const newWalking = (mode?.key === 'copy' || mode?.key === 'cut');
    setIsWalking(newWalking);
    setThemedType(mode?.key === 'cut' ? "warning" : "info");
    // TODO - if was walking and !newWalking the do ripple (what is ref not working?)
  }, [editModeHandler]);

  return (
    <CommandButton
      ref={refForwarded}
      command={command}
      icon={themeIcon(
        <WalkingCopyIcon
          isWalking={isWalking}
          themedType={themedType}
        />
      )}
      {...rest}
    />
  );

}));

export default WalkingCopyCommandButton;