import type React from 'react';
import { memo, forwardRef } from 'react';

import { type TooltipProps } from '@mui/material';

import { useCommands, type IKeyStroke, type ResolvedCommand } from '@sheetxl/utils-react';

import { ExhibitTooltip } from '../button';

export interface CommandTooltipProps extends Omit<TooltipProps, "title"> {
  commandKey?: string;
  command?: ResolvedCommand;

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
    commandKey: propCommandKey,
    command: propCommand,
    disabled: propDisabled,
    shortcut: propShortcut,
    children,
    ...rest
  } = props;

  const [commandLookup] = useCommands(propCommandKey ?? []);
  const command = propCommand ?? commandLookup;

  const commandShortcut = command?.getShortcut();
  return (
    <ExhibitTooltip
      ref={refForwarded}
      label={propDisabled !== undefined ? command?.getLabel() : ''}
      shortcut={propShortcut !== undefined ? propShortcut : (Array.isArray(commandShortcut) ? commandShortcut[0] : commandShortcut)}
      description={command?.getDescription()}
      disabled={propDisabled}
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
