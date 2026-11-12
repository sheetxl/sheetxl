import { memo } from 'react';

import { type CommandContext } from '@sheetxl/react';

import { type InputDialogProps } from '@sheetxl/utils-mui';

import { SparklineRangesDialog, type SparklineRangesDialogProps } from './SparklineNewDialog';

export interface SparklineEditDialogProps extends InputDialogProps<CommandContext.EditSparklines> {};

/**
 * Excel's Edit Sparklines: a group's cells and the cells they draw, each one or more areas.
 */
export const SparklineEditDialog = memo<SparklineEditDialogProps>((props: SparklineEditDialogProps) => {
  return <SparklineRangesDialog {...props as SparklineRangesDialogProps} variant="edit" />;
});

export default SparklineEditDialog;
