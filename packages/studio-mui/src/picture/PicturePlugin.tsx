import { Command, type CommandButtonProps } from '@sheetxl/utils-react';

import { ShapeGalleryCommandButton, ClosedShapeCategories } from '../shape';

/**
 * The studio's additions to pictures, added through the picture kind's contribution points as any
 * host's would be.
 */
export const PicturePlugin = (): (() => void) => {
  const registry = Command.DefaultCommandButtonRegistry;
  const removers: (() => void)[] = [];

  // Change Picture opens the Picture tab, as Excel's does: a split button that quick-clicks the file
  // dialog and offers file / web, modeled on `insertImageOptions`.
  removers.push(registry.register({
    key: 'changePictureOptions',
    defaultKey: 'changePictureFromFile',
    members: ['changePictureFromFile', 'changePictureFromURL'],
    contributions: { pictureToolbar: { order: -3 } }
  }, true));

  // The link a click on the picture follows: a click adds or edits it, the rest are in the popup.
  removers.push(registry.register({
    key: 'pictureHyperlinkOptions',
    defaultKey: 'updatePictureHyperlink',
    members: ['updatePictureHyperlink', 'openPictureHyperlink', 'deletePictureHyperlink'],
    contributions: { pictureToolbar: { order: -2 } }
  }, true));

  // Excel's Crop menu: the Insert > Shapes gallery running the picture kind's `cropToShape`, the
  // aspect ratios and the two ways to place the image in its frame. The crop editor comes first in
  // Excel's and is not here yet.
  removers.push(registry.register({
    key: 'cropAspectOptions',
    members: [
      'cropAspect1x1',
      '-',
      'cropAspect2x3',
      'cropAspect3x4',
      'cropAspect3x5',
      'cropAspect4x5',
      '-',
      'cropAspect3x2',
      'cropAspect4x3',
      'cropAspect5x3',
      'cropAspect5x4',
      'cropAspect16x9',
      'cropAspect16x10'
    ]
  }, true));
  removers.push(registry.register({
    key: 'cropOptions',
    members: [
      {
        key: 'cropToShapeGallery',
        render: (props: CommandButtonProps) => (
          <ShapeGalleryCommandButton {...(props as any)} commandKey="cropToShape" excludeCategories={ClosedShapeCategories}/>
        )
      },
      'cropAspectOptions',
      '-',
      'cropFill',
      'cropFit'
    ],
    contributions: { pictureToolbar: { order: -1, divider: 'after' } }
  }, true));

  return (): void => {
    for (const remove of removers) remove();
  };
};
