import React from 'react';

import { DefaultDynamicIconService } from '@sheetxl/utils-react';

import { DefaultTaskPaneRegistry } from '@sheetxl/react';

import { TableDetailsTaskPane } from './TableDetailsTaskPane';

export const TablePlugin = () => {

  DefaultDynamicIconService.register(
    'plugin-table', {
      icons: {
      }
    }
  );

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
}