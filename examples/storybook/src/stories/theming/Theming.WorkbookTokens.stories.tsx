import React, { useMemo } from 'react';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookElement, type ExplicitTokens } from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * **The `tokens` prop.** The React form of the CSS-variable override path (the same result as the "CSS
 * Variables" story, without hand-writing the `<style>`). Values are addressed by mode and surface; they emit
 * into the top `sxl-overrides` layer, scoped to this workbook, and follow its mode. Everything you don't state
 * keeps its default.
 *
 * An `app` value reaches every surface in its mode; state a `grid` or `header` cell to make that surface
 * differ. The **Playground** story edits every cell live.
 */
const TOKENS: ExplicitTokens = {
  light: { app: { 'color-primary': '#6d28d9', 'color-accent': '#0891b2' } },
  dark: { app: { 'color-primary': '#a78bfa', 'color-accent': '#22d3ee' } }
};

const Template: React.FC = (props) => {
  const { mode = 'light' } = props as any;
  const workbook = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    wb.getWorksheetAt(0).getRange('A1:B1').setValues([['Hello', 'World']]);
    return wb;
  }, []);

  return (
    <WorkbookElement
      workbook={workbook}
      colorScheme={mode}
      gridColorScheme={mode}
      tokens={TOKENS}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export const Tokens = asStory(Template);
Tokens.args = { mode: 'light' };
Tokens.argTypes = { mode: { control: 'inline-radio', options: ['light', 'dark', 'auto'], name: 'mode' } };
Tokens.storyName = 'Workbook Tokens';

const Story = {
  title: 'Theming',
  component: WorkbookElement,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
