import React, { useMemo } from 'react';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * **Theme via plain CSS variables.** No MUI and no SheetXL API: redefine the `--sxl-*` tokens in the
 * `@layer sxl-overrides` layer, which wins over the defaults regardless of specificity or of where your
 * stylesheet sits on the page. Values are keyed by `data-sxl-theme-mode`, so light and dark each get their
 * own; add `data-sxl-theme-surface` to address the grid or headers alone (see the **Playground** story).
 *
 * This themes the `--sxl-*` layer, which is everything in a MUI-free surface like `<WorkbookElement>`. A MUI
 * `<Studio>`'s own components read the MUI palette in JavaScript, so a stylesheet does not reach them; pass
 * Studio's `tokens` prop instead (see **Studio Tokens**).
 *
 * Do this in a stylesheet, not inline `style={{ '--sxl-color-primary': … }}`: a descendant that switches
 * surface re-declares the token on itself and beats an inherited inline value.
 */
const OVERRIDES = `
@layer sxl-overrides {
  [data-sxl-theme-mode="light"] {
    --sxl-color-primary: #6d28d9;   /* selection and interaction */
    --sxl-radius-field:  6px;
  }
  [data-sxl-theme-mode="dark"] {
    --sxl-color-primary: #a78bfa;
  }
}
`;

const Template: React.FC = (props) => {
  const { mode = 'light' } = props as any;
  const workbook = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    wb.getWorksheetAt(0).getRange('A1:B1').setValues([['Hello', 'World']]);
    return wb;
  }, []);

  return (
    <>
      <style>{OVERRIDES}</style>
      <WorkbookElement workbook={workbook} colorScheme={mode} style={{ width: '100%', height: '100%' }} />
    </>
  );
};

export const CSSVariables = asStory(Template);
CSSVariables.args = { mode: 'light' };
CSSVariables.argTypes = { mode: { control: 'inline-radio', options: ['light', 'dark'], name: 'mode' } };
CSSVariables.storyName = 'Workbook CSS';

const Story = {
  title: 'Theming',
  component: WorkbookElement,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
