import { type IWorkbook } from '@sheetxl/sdk';

import { type TaskPaneProps, useWorkbook, useModelSync } from '@sheetxl/react';

import { ScriptWorkspace } from './ScriptWorkspace';
import { ScriptCommandProvider } from './ScriptCommandProvider';

export const ScriptTaskPane = (props: TaskPaneProps) => {
  const {
    model: propWorkbook,
    entryKey,
    frame,
    ref,
    ...rest
  } = props;
  // The `model` prop is baked into the (kept-mounted) frame element when the pane first opens, so it
  // goes stale across a workbook swap. Read the live workbook from context instead — it follows the
  // shown workbook — and fall back to the passed `model` as an initial/arming value.
  const workbook: IWorkbook = useWorkbook() ?? propWorkbook;
  // Scripts are workbook structure: read-only while it is protected.
  useModelSync<IWorkbook.IListeners>(workbook, ['onProtectionChange']);
  const readOnly = workbook?.getScripts().isReadOnly() ?? false;
  // Wrap the workspace in the script container's OWN command resolver (2nd resolver, shared root).
  return (
    <ScriptCommandProvider>
      <ScriptWorkspace
        ref={ref}
        readOnly={readOnly}
        frame={frame}
        scripts={workbook?.getScripts()}
        {...rest}
      />
    </ScriptCommandProvider>
  )
};
