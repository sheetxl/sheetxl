import { DefaultCommandButtonRegistry, type CommandButtonProps } from '@sheetxl/utils-react';

import { registerMovablePane } from '@sheetxl/react';

import { ShapeGalleryCommandButton } from './ShapeGalleryCommandButton';

/** Change Shape and Crop to Shape offer no lines or connectors: a box cannot become one. */
export const ClosedShapeCategories: readonly string[] = ['lines'];

/**
 * The studio's additions to shapes: widgets react has no MUI for, added through the shape kind's
 * contribution points as any host's would be.
 */
export const ShapePlugin = (): (() => void) => {
  // Change Shape opens the Shape tab, as Excel's does: the Insert > Shapes gallery running the shape
  // kind's `changeShape`.
  const removeChangeShape = DefaultCommandButtonRegistry.register({
    key: 'changeShapeGallery',
    contributions: { shapeToolbar: { order: -1, divider: 'after' } },
    render: (props: CommandButtonProps) => (
      <ShapeGalleryCommandButton {...(props as any)} commandKey="changeShape" excludeCategories={ClosedShapeCategories}/>
    )
  }, true);

  // The format pane's body for a shape: Excel's Fill & Line, on the Format Cells pane's controls.
  const removePane = registerMovablePane('shape', () => import('./ShapeFormatPanel').then((m) => m.ShapeFormatPanel));

  return (): void => {
    removeChangeShape();
    removePane();
  };
};
