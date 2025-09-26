import { type TaskPaneProps } from '@sheetxl/react';

import { TableDetailsPanel } from './TableDetailsPanel';

export const TableDetailsTaskPane = (props: TaskPaneProps, ref: React.Ref<HTMLDivElement>) => {
  const {
    model: workbook,
    commands,
    entryKey,
    frame,
    ...rest
  } = props;
  return (
    <TableDetailsPanel
      ref={ref}
      commands={commands}
      // frame={frame}
      {...rest}
    />
  )
};