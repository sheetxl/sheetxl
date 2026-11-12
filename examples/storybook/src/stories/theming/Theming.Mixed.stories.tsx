import React from 'react';

import { Grid, buildGridThemeCSS } from '@sheetxl/grid-react';

import { asStory, sharedCellRenderer } from '../../components';

/**
 * **Mixing proof** — two grids side by side. The left grid inherits the app `mode` (toggle it); the right
 * grid carries its own `data-sxl-theme-mode="dark"`, so it stays dark even when the app is light. That's
 * the entire reason for the two-attribute model: a subtree flips mode with **one attribute**, no JS
 * re-inject, native scrollbars follow (`color-scheme`), and it composes with the grid surface tokens.
 */
const THEME_CSS = buildGridThemeCSS();

const Panel: React.FC<{ label: string; forceMode?: 'light' | 'dark'; count: number }> = ({ label, forceMode, count }) => (
  <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minWidth: 0, gap: 4 }}>
    <div style={{ fontFamily: 'var(--sxl-font-family)', fontSize: 12, opacity: 0.7 }}>{label}</div>
    <div
      data-sxl-theme-surface="grid"
      {...(forceMode ? { 'data-sxl-theme-mode': forceMode } : {})}
      style={{
        display: 'flex',
        flex: '1',
        minHeight: '360px',
        background: 'var(--sxl-color-base-100)',
        // A surface container must paint BOTH bg and text from its tokens, else nested/mixed surfaces
        // (a dark grid in a light app) inherit the ancestor's text color — dark-on-dark.
        color: 'var(--sxl-color-base-content)',
        border: '1px solid var(--sxl-color-base-300)'
      }}
    >
      <Grid columnCount={count} rowCount={count} style={{ position: 'relative', flex: '1' }} renderCells={sharedCellRenderer} />
    </div>
  </div>
);

const Template: React.FC = (props) => {
  const { mode = 'light', count = 200 } = props as any;
  return (
    <>
      <style>{THEME_CSS}</style>
      <div
        data-sxl-theme-mode={mode}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          gap: 12,
          padding: 12,
          boxSizing: 'border-box',
          background: 'var(--sxl-color-base-200)',
          color: 'var(--sxl-color-base-content)'
        }}
      >
        <Panel label={`app mode = ${mode} (inherited)`} count={count} />
        <Panel label="forced dark (data-sxl-theme-mode=&quot;dark&quot;)" forceMode="dark" count={count} />
      </div>
    </>
  );
};

export const Mixed = asStory(Template);
Mixed.args = { mode: 'light', count: 200 };
Mixed.argTypes = { mode: { control: 'inline-radio', options: ['light', 'dark'], name: 'mode' } };
Mixed.storyName = 'Mixed (dark grid in light app)';

const Story = {
  title: 'Theming',
  component: Grid,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
