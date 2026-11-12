import { defineLazyModule } from '@sheetxl/utils';
import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const FormatTaskPane = lazyPanel(
  defineLazyModule('studio:formatTaskPane', () => import('./FormatTaskPane'), {
    select: (m) => ({ default: m.FormatTaskPane })
  }).load
);

/**
 * Registers the Format Cells task pane. Called from the studio bootstrap alongside the other
 * built-in panes.
 */
export const FormatPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.FormatCells,
    component: FormatTaskPane
  }, true);
};
