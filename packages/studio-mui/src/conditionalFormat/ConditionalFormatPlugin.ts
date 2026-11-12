import { defineLazyModule } from '@sheetxl/utils';
import { TaskPaneKey, DefaultTaskPaneRegistry } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const ConditionalFormatDetailsTaskPane = lazyPanel(
  defineLazyModule('studio:conditionalFormatDetailsTaskPane', () => import('./ConditionalFormatDetailsTaskPane'), {
    select: (m) => ({ default: m.ConditionalFormatDetailsTaskPane })
  }).load
);

export const ConditionalFormatPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.ConditionalFormat,
    component: ConditionalFormatDetailsTaskPane
  }, true);
}
