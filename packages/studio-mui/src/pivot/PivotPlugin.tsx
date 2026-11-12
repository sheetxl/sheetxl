import type React from 'react';

import { DefaultTaskPaneRegistry, PivotTablePane, TaskPaneKey, type PivotTablePaneProps, type PivotTableHeaderProps } from '@sheetxl/react';

import { defaultRenderPivotMenu } from '../workbook/DefaultRenderers';

import { renderPivotChipMenu } from './PivotChipMenu';
import { PivotTableHeader } from './PivotTableHeader';

const renderPivotTableHeader = (props: PivotTableHeaderProps): React.ReactNode => <PivotTableHeader {...props} />;

const StudioPivotTablePane = (props: PivotTablePaneProps): React.ReactElement => (
  <PivotTablePane renderMenu={renderPivotChipMenu} renderFilter={defaultRenderPivotMenu} renderHeader={renderPivotTableHeader} {...props} />
);

/** Registers the PivotTable Fields pane with the studio's menus. */
export const PivotPlugin = (): (() => void) => {
  return DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.PivotTable,
    component: StudioPivotTablePane
  }, true);
};
