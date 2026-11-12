import { defineLazyModule } from '@sheetxl/utils';

import { TaskPaneKey, DefaultTaskPaneRegistry } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const CommentsTaskPane = lazyPanel(
  defineLazyModule('studio:commentsTaskPane', () => import('./CommentsTaskPane'), {
    select: (m) => ({ default: m.CommentsTaskPane })
  }).load
);

/**
 * Registers the **Comments** pane, which `showCommentsPane` opens and `updateComments` writes in
 * while it is showing.
 */
export const CommentsPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.Comments,
    component: CommentsTaskPane
  }, true);
}
