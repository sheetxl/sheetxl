import { defineLazyModule } from '@sheetxl/utils';
import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const ExternalLinksTaskPane = lazyPanel(
  defineLazyModule('studio:externalLinksTaskPane', () => import('./ExternalLinksTaskPane'), {
    select: (m) => ({ default: m.ExternalLinksTaskPane })
  }).load
);

/**
 * Registers the **Workbook Links** pane, which `manageExternalLinks` opens.
 */
export const ExternalLinksPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.ExternalLinks,
    component: ExternalLinksTaskPane
  }, true);
}
