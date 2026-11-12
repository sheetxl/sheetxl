import React from 'react';

import { Grid, buildGridThemeCSS } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * Bare `Grid` on the two-attribute token model. The theme CSS is injected **once** (`<style>`); the grid
 * is mode-agnostic — it just reads `var(--sxl-color-*)`. `data-sxl-theme-mode` selects the mode (sets
 * `color-scheme` + values); `data-sxl-theme-surface="grid"` selects the grid surface. First layer proven:
 * gridlines (`base-300`).
 */
const THEME_CSS = buildGridThemeCSS();

const Template: React.FC = (props) => {
  const { mode = 'light', ...rest } = props as any;

  return (
    <>
      <style>{THEME_CSS}</style>
      <div
        data-sxl-theme-mode={mode}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sxl-color-base-100)',
          color: 'var(--sxl-color-base-content)'
        }}
      >
        <div data-sxl-theme-surface="grid" data-sxl-theme-mode={mode} style={{ display: 'flex', flex: '1', minHeight: '400px' }}>
          <Grid
            {...rest}
            style={{ position: 'relative', flex: '1' }}
            renderCells={sharedCellRenderer}
          />
        </div>
      </div>
    </>
  );
};

export const Grid_ = asStory(Template);
Grid_.args = {
  columnCount: 200,
  rowCount: 200,
  mode: 'light'
};
Grid_.argTypes = {
  mode: { control: 'inline-radio', options: ['light', 'dark'], name: 'mode' }
};
Grid_.storyName = 'Grid';

const Story = {
  title: 'Theming',
  component: Grid,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
