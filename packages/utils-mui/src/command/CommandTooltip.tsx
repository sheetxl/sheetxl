import React, { memo, forwardRef } from 'react';

import { type TooltipProps } from '@mui/material';

import { useCommand, ICommand, IKeyStroke } from '@sheetxl/utils-react';

import { ExhibitTooltip } from '../button';

export interface CommandTooltipProps extends Omit<TooltipProps, "title"> {
  command: ICommand<any, any>;
  /**
   * The shortcut to display.
   * @remarks
   * This is display only and doesn't actually track the shortcut.
   * Override the display for the shortcut on the command (if available).
   */
  shortcut?: IKeyStroke | IKeyStroke[];
  /**
   * Prevent tooltip from showing
   */
  disabled?: boolean;
}

export const CommandTooltip: React.FC<CommandTooltipProps & { ref?: any }> = memo(
  forwardRef<React.ReactElement<any, any>, CommandTooltipProps>((props, refForwarded) => {
  const {
    command,
    disabled: propDisabled = false,
    shortcut: propShortcut,
    children,
    ...rest
  } = props;

  const _ = useCommand(command);

  return (
    <ExhibitTooltip
      ref={refForwarded}
      label={propDisabled !== undefined ? command?.getLabel() : ''}
      shortcut={propShortcut !== undefined ? propShortcut : Array.isArray(command?.getShortcut()) ? command?.getShortcut()[0]: command?.getShortcut()}
      description={command?.getDescription()}
      disabled={propDisabled}
      chips={command?.getTags()}
      componentDisabled={command?.disabled()}
      {...rest}
    >
      <div // for the disabled feature
        style={{
          display: 'flex',
          flex: '1 1 0%'
        }}
      >
        {children}
      </div>
    </ExhibitTooltip>
  )
}));
