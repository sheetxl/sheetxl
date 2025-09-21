import { type TaskPaneProps } from '@sheetxl/react';

import { ScriptWorkspace, type IScriptWorkspaceElement } from './ScriptWorkspace';

export const ScriptTaskPane = (props: TaskPaneProps, ref: React.Ref<IScriptWorkspaceElement>) => {
  const {
    model: workbook,
    commands,
    entryKey,
    frame,
    ...rest
  } = props;
  const disabled = false;//!protection.isStructureAllowed();
  return (
    <ScriptWorkspace
      ref={ref}
      readOnly={disabled}
      commands={commands}
      frame={frame}
      scripts={workbook?.getScripts()}
      {...rest}
    />
  )
};