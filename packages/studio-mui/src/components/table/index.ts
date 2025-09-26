import { DefaultTaskPaneRegistry } from '@sheetxl/react';

export * from './TableStylePreview';
export * from './TableStyleCanvasPreview';

export * from './TableStyleOptionsPanel';
export * from './TableDetailsPanel';

import { TableDetailsTaskPane } from './TableDetailsTaskPane';

DefaultTaskPaneRegistry.registerTaskPane({
  key: 'tableDetails',
  getTitle(): string {
    return 'Table Details';
  },
  getIcon(): React.ReactElement | string {
    return 'Table';
  },
  renderTaskPane: TableDetailsTaskPane
}, true);