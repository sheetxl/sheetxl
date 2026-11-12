import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { useCommands, useCommandButtonEntry } from '@sheetxl/utils-react';

import {
  CommandPopupButton, defaultRenderPopupPanel,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { RunScriptPopupPanel } from './RunScriptPopupPanel';

export interface RunScriptCommandButtonProps extends CommandPopupButtonProps {}

/**
 * Menu for Quick run of scripts.
 */
export const RunScriptCommandButton: React.FC<RunScriptCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, RunScriptCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    disabled: propDisabled,
    ...rest
  } = props;

  const quickCommandKey = 'showScriptEditor';
  const resolvedCommands = useCommands(['showScriptEditor']);

  const commandShowScriptEditor = resolvedCommands[0];
  const entry = useCommandButtonEntry('scriptsOptions');

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const panel = (
      <RunScriptPopupPanel
        disabled={propDisabled}
        groupKey={groupKey}
        {...props}
      />
    );
    return defaultRenderPopupPanel({...props, children: panel});
  }, [propDisabled, groupKey]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      disabled={propDisabled}
      renderPopupPanel={renderPopupPanel}
      selected={commandShowScriptEditor?.getState()}
      // Head chrome from the registered `scriptsOptions` entry (catalog-backed, language-aware).
      // TODO - provide the name of the function/script in the label.
      label={entry?.getLabel?.()}
      tooltip={entry?.getDescription?.()}
      // TODO - create a quickExecuteScriptCommand
      quickCommand={quickCommandKey}
      {...rest}
    />
  )
}));