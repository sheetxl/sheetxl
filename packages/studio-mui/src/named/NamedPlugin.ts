import { defineLazyModule } from '@sheetxl/utils';
import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const NamedDetailsTaskPane = lazyPanel(
  defineLazyModule('studio:namedDetailsTaskPane', () => import('./NamedDetailsTaskPane'), {
    select: (m) => ({ default: m.NamedDetailsTaskPane })
  }).load
);

export const NamedPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.Names,
    component: NamedDetailsTaskPane
  }, true);
}
