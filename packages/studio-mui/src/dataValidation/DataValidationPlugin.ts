import { defineLazyModule } from '@sheetxl/utils';

import { TaskPaneKey, DefaultTaskPaneRegistry } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const DataValidationDetailsTaskPane = lazyPanel(
  defineLazyModule('studio:dataValidationDetailsTaskPane', () => import('./DataValidationDetailsTaskPane'), {
    select: (m) => ({ default: m.DataValidationDetailsTaskPane })
  }).load
);

export const DataValidationPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.DataValidation,
    component: DataValidationDetailsTaskPane
  }, true);
}