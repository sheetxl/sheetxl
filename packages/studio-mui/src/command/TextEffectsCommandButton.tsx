import {
  memo, forwardRef, useCallback
} from 'react';

import { useCommands, useCommandButtonRegistry, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, defaultRenderPopupPanel,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

/**
 * Menu for text effects options
 */
export const TextEffectsCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    disabled: propDisabled,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatStrikeThroughToggle',
    'formatSuperscriptToggle',
    'formatSubscriptToggle'
  ];
  const resolvedCommands = useCommands(commandKeys);

  // Chrome comes from this component's own registered entry (SheetCommandGroups), where it
  // resolves through the language service; the literals here are only a not-registered fallback.
  const entry = useCommandButtonRegistry().get('textEffectsOptions');
  const label = (entry?.getLabel?.() as React.ReactNode) ?? 'Text Effects';
  const tooltip = entry?.getDescription?.() ?? 'Style your text to differentiate it.';

  let activeCommand: string | null = null;
  let anyEnabled = false;
  const resolvedCommandsLength = resolvedCommands.length
  for (let i=0; !activeCommand && i<resolvedCommandsLength; i++) {
    const command = resolvedCommands[i];
    if (!command || command.disabled()) continue;
    anyEnabled = true;
    if (command.getState()) {
      activeCommand = commandKeys[i];
    }
  }
  if (!activeCommand) {
    activeCommand = commandKeys[0];
  }

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey: 'textEffectsOptions',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        commandKey={'formatStrikeThroughToggle'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'formatSuperscriptToggle'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'formatSubscriptToggle'}
      />
    </>);
    return defaultRenderPopupPanel({...props, children});
  }, [propDisabled, groupKey]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={activeCommand}
      disabled={propDisabled ?? !anyEnabled}
      renderPopupPanel={renderPopupPanel}
      label={label}
      tooltip={tooltip}
      {...rest}
    />
  )
}));