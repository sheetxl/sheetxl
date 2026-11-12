import { type IDataValidation } from '@sheetxl/sdk';

import { type TaskPaneProps, type ItemsPaneArgs } from '@sheetxl/react';

import { DataValidationDetailsPanel } from './DataValidationDetailsPanel';

export const DataValidationDetailsTaskPane = (
  props: TaskPaneProps<any, ItemsPaneArgs<IDataValidation.Properties>>
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
    <DataValidationDetailsPanel
      ref={ref}
      workbook={workbook}
      args={args}
      {...rest}
    />
  )
};
