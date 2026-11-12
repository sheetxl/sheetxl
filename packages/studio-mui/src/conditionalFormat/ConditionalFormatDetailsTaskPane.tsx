import { type IConditionalFormat } from '@sheetxl/sdk';

import { type TaskPaneProps, type ItemsPaneArgs } from '@sheetxl/react';

import { ConditionalFormatDetailsPanel } from './ConditionalFormatDetailsPanel';

export const ConditionalFormatDetailsTaskPane = (
  props: TaskPaneProps<any, ItemsPaneArgs<IConditionalFormat.Properties>>
) => {
  const {
    model: workbook,
    entryKey,
    frame,
    args,
    ref,
    ...rest
  } = props;
  return (
    <ConditionalFormatDetailsPanel
      ref={ref}
      workbook={workbook}
      args={args}
      {...rest}
    />
  )
};
