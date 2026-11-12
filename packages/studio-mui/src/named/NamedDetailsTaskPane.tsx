import { type INamed } from '@sheetxl/sdk';

import { type TaskPaneProps, type ItemsPaneArgs } from '@sheetxl/react';

import { NamedDetailsPanel } from './NamedDetailsPanel';

export const NamedDetailsTaskPane = (props: TaskPaneProps<any, ItemsPaneArgs<never, INamed>>) => {
  const {
    model: workbook,
    entryKey,
    frame,
    args,
    ref,
    ...rest
  } = props;
  return (
    <NamedDetailsPanel
      ref={ref}
      workbook={workbook}
      args={args}
      {...rest}
    />
  )
};
