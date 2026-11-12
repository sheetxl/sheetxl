import { defineLazyModule } from '@sheetxl/utils';

import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const TableDetailsTaskPane = lazyPanel(
  defineLazyModule('studio:tableDetailsTaskPane', () => import('./TableDetailsTaskPane'), {
    select: (m) => ({ default: m.TableDetailsTaskPane })
  }).load
);

export const TablePlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.TableDetails,
    component: TableDetailsTaskPane
  }, true);
}