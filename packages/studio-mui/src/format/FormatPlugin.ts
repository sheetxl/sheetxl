import { defineLazyModule } from '@sheetxl/utils';
import { registerFormatCellsPane, registerFormatPane } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const FormatTaskPane = lazyPanel(
  defineLazyModule('studio:formatTaskPane', () => import('./FormatTaskPane'), {
    select: (m) => ({ default: m.FormatTaskPane })
  }).load
);

/**
 * Supplies the cells' body of the Format task pane, and registers the pane. Called from the studio
 * bootstrap alongside the other built-in panes.
 */
export const FormatPlugin = (): (() => void) => {
  registerFormatPane();
  return registerFormatCellsPane(FormatTaskPane);
};
