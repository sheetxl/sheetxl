import React, { useState } from 'react';

import { Worksheet } from '@sheetxl/sdk';

import { WorksheetElement } from '@sheetxl/react';

import { registerStoryCellControls, seedCellControls, RATING_CSS, BUTTON_CSS } from '../../components/storyCellControls';

import { asStory } from '../../components';

/**
 * **Cell controls and rich values of your own**, on a bare sheet: a rating (several hit zones in
 * one cell, a CSS hover preview, digit keys over the selection), a slider (its own drag through
 * `props.context`) over plain numbers and over range values, and buttons, beside the built-in
 * checkbox. See `components/storyCellControls.tsx` for the two registrations each one is; the
 * studio story mounts the same ones in the full studio, with the options pane and a macro.
 */
registerStoryCellControls();

const Template: React.FC = () => {
  const [sheet] = useState(() => {
    const sheet = new Worksheet();
    seedCellControls(sheet);
    return sheet;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{RATING_CSS + BUTTON_CSS}</style>
      <WorksheetElement style={{ minHeight: 400, flex: 1, border: '1px solid #ddd' }} sheet={sheet} />
    </div>
  );
};

export const CellControls = asStory(Template);
CellControls.storyName = 'Custom cell controls';

const Story = {
  title: 'Sheet/Cell Controls',
  component: CellControls,
};
export default Story;
