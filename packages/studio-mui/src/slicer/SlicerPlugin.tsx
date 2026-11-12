import { DefaultCommandButtonRegistry } from '@sheetxl/utils-react';

import { PresetSlicerStylesCommandButton } from './PresetSlicerStylesCommandButton';
import { InsertSlicerCommandButton } from './InsertSlicerCommandButton';

/**
 * The studio's additions to slicers, added through the slicer kind's contribution points as any
 * host's would be.
 */
export const SlicerPlugin = (): (() => void) => {
  // The style gallery leads the Slicer tab, set apart from the drawing groups.
  const removeStyles = DefaultCommandButtonRegistry.register({
    key: 'formatSlicerStyle',
    contributions: { slicerToolbar: { order: -1, divider: 'after' } },
    render: (props) => <PresetSlicerStylesCommandButton {...(props as any)} commandKey="formatSlicerStyle"/>
  }, true);
  // Insert Slicer on the Table and PivotTable tabs.
  const removeInsert = DefaultCommandButtonRegistry.register({
    key: 'insertSlicer',
    render: (props) => <InsertSlicerCommandButton {...(props as any)} commandKey="insertSlicer"/>
  }, true);

  return (): void => {
    removeStyles();
    removeInsert();
  };
};
