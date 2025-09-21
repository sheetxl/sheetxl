import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, useCommands } from '@sheetxl/utils-react';

import {
  CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { IScriptEditor } from '@sheetxl/react';

import { RunScriptPopupPanel } from './RunScriptPopupPanel';

export interface RunScriptCommandButtonProps extends CommandPopupButtonProps {}

/**
 * Menu for Quick run of scripts.
 */
export const RunScriptCommandButton: React.FC<RunScriptCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, RunScriptCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const quickCommandKey = 'showScriptEditor';
  const resolvedCommands = useCommands(propCommands, ['executeScript', 'showScriptEditor']);

  const executeScriptCommand = resolvedCommands[0];
  const context:IScriptEditor.Context = executeScriptCommand.context() as unknown as IScriptEditor.Context; // ExecuteScriptContext

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const panel = (<RunScriptPopupPanel {...props} commands={commands} />);
    return defaultCreatePopupPanel({...props, children: panel});
  }, [propDisabled, context, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      selected={propCommands.getCommand(quickCommandKey).state()}
      label="Macros" // TODO - provide the name of the function
      tooltip="Run or manage macros." // TODO - provide the name of the script
      // TODO - create a quickExecuteScriptCommand
      quickCommand={quickCommandKey}
      {...rest}
    />
  )

}));

export default RunScriptCommandButton;