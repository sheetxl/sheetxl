import React, {
  forwardRef, memo
} from 'react';

import { IKeyStroke } from '@sheetxl/utils-react';

import {
  ExhibitIconButton, ExhibitIconButtonProps, ExhibitTooltip
} from '.';

interface ExhibitOptionButtonProps extends ExhibitIconButtonProps {
  onSelectToggle?: (value: boolean) => void;
  selected?: boolean;
  label: NonNullable<React.ReactNode>;
  shortcut?: IKeyStroke;
  preventFocus?: boolean;
  tabIndex?: number;
}

export const ExhibitOptionButton: React.FC<ExhibitOptionButtonProps & { ref?: any }> = memo(
  forwardRef<any, ExhibitOptionButtonProps>((props: ExhibitOptionButtonProps, refForwarded) => {
  const {
    onSelectToggle,
    selected = false,
    label,
    shortcut,
    tabIndex=0,
    preventFocus=false,
    ...rest
  } = props;

  return (
    <ExhibitTooltip
      label={label}
      shortcut={shortcut}
    >
      <ExhibitIconButton
        ref={refForwarded}
        outlined={false}
        tabIndex={tabIndex}
        selected={selected}
        onMouseDown={(e): void => {
          if (preventFocus)
            e.preventDefault();
        }}
        onClick={(): void => {
          onSelectToggle?.(!selected);
        }}
        {...rest}
      />
    </ExhibitTooltip>
  );
}));