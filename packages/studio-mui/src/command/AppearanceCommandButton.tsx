import { memo, forwardRef } from 'react';

import { useMediaQuery } from '@mui/material';

import {
  useCommands, useCommandButtonEntry, CommandButtonType, useCallbackRef, type ThemeMode
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, defaultRenderPopupPanel, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export const AppearanceCommandButton = memo(forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    disabled: propDisabled,
    ...rest
  } = props;

  // Close-on-execute is handled automatically: the popup members render inside this button's float,
  // and `useCommands` closes the enclosing float on execute (`useFloat`) — no per-button wiring.
  const [commandMode] = useCommands(['themeMode']);
  const entry = useCommandButtonEntry('appearanceOptions');

  const renderPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey: 'appearanceOptions',
      disabled: propDisabled
    }

    const children = (<>
      <CommandButton
        {...commandButtonProps}
        commandKey={'themeMode'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'defaultThemeMode'}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        commandKey={'enableDarkGrid'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'enableDarkImages'}
      />
    </>);
    return defaultRenderPopupPanel({...props, children});
  }, [propDisabled, commandMode, groupKey]);

  const darkModeUserOverride:ThemeMode = commandMode?.getState();
  const darkModeSystemDefault = useMediaQuery('(prefers-color-scheme: dark)');
  const currentDark = darkModeUserOverride === 'dark' || (darkModeUserOverride === null && darkModeSystemDefault);
  const isUserOverride = commandMode?.getState() !== null;

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={'themeMode'}
      renderPopupPanel={renderPopupPanel}
      // Head chrome comes from the registered `appearanceOptions` entry (catalog-backed, language-aware).
      label={entry?.getLabel?.()}
      tooltip={entry?.getDescription?.()}
      onQuickClick={() => { commandMode?.execute(currentDark ? 'light' : 'dark') }}
      selected={isUserOverride}
      {...rest}
    />
  )
}));
