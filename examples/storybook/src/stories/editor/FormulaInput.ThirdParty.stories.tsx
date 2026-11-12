import React, { useMemo, useState, type ReactNode } from 'react';

import { Workbook, type IWorkbook, type ICalculation } from '@sheetxl/sdk';

import { FormulaInput, WorkbookProvider } from '@sheetxl/react';

import { Studio } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/** Show the last emitted value's own text (an `IFormula`), or the seeded string before any edit. */
const asText = (v: ICalculation.IFormula | string | null): string => {
  if (v == null) return '(none)';
  return typeof v === 'string' ? v : v.getExpression();
};

/** A labeled field + its live value readout — plain story chrome, not part of the widget. */
const Labeled: React.FC<{ caption: string; readout: string; children: ReactNode }> = (props) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 0', minWidth: 220 }}>
    <span style={{ fontFamily: 'sans-serif', fontSize: 12, opacity: 0.8 }}>{props.caption}</span>
    {props.children}
    <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>→ {props.readout}</span>
  </div>
);

/**
 * **Third-party `FormulaInput`s over a full Studio** — the pattern for adding formula-backed fields
 * to your own UI. One `Workbook` model is shared by everything: the app creates it, hands it to the
 * `<Studio>`, and wraps its OWN fields in a `<WorkbookProvider>` (from `@sheetxl/react`) — the
 * fields resolve the workbook from context, exactly like the Studio's built-in dialogs do, so none
 * of them takes a `workbook` prop here. (A field outside any provider can take the model via its
 * `workbook` prop instead — see the FormulaField story.)
 *
 * Three fields, three modes of the SAME component:
 * - **Formula · live** — the default grammar; every valid keystroke/pick emits (`onChangeInput`).
 * - **Formula · done** — `changeOn="done"` + `onDone`: the host hears only commits (Enter / the ✓
 *   adornment / blur); while engaged the field shows the modal ✓/✗ pair.
 * - **Reference · done** — `grammar="reference"`, the "limit input": a pure (multi-)reference list;
 *   function calls and a leading `=` are invalid.
 *
 * Try it: focus a field and drag on the grid, arrow-pick, switch sheet tabs mid-pick, hover a
 * reference or sub-expression for its evaluated value, F4 to cycle `$`, Escape to revert.
 * Fields are always colored — except while ANOTHER field (or the cell editor) is actively picking:
 * one editor at a time owns the highlight language, the rest stand down to plain text. In a formula
 * field the caret decides whether arrows pick: on a reference they re-scope it; on `SUM` they move
 * the caret (the references stay displayed on the grid either way).
 */
const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo(() => {
    const wb = new Workbook();
    wb.addWorksheet('Sheet2');
    const s = wb.getWorksheetAt(0);
    s.getRange('A1:B3').setValues([[1, 2], [3, 4], [5, 6]]);
    s.getRange('D1').setValue('Focus a field, then pick on the grid.');
    wb.getWorksheet('Sheet2').getRange('C1:D4').setValues([[10, 20], [30, 40], [50, 60], [70, 80]]);
    return wb;
  }, []);

  // Each field is CONTROLLED — the emitted `IFormula` echoes back into `value`, exactly what a real
  // host (a chart-source panel, a rule editor) does.
  const [live, setLive] = useState<ICalculation.IFormula | string | null>('=SUM(A1:B3)*2');
  const [committed, setCommitted] = useState<ICalculation.IFormula | string | null>(null);
  const [reference, setReference] = useState<ICalculation.IFormula | string | null>('Sheet2!C1:D4');

  return (
    <WorkbookProvider workbook={workbook}>
      <div className="storybook-container" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '4px 2px' }}>
          <Labeled caption="Formula · live (emits every valid change)" readout={asText(live)}>
            <FormulaInput
              value={live}
              onChangeInput={setLive}
            />
          </Labeled>
          <Labeled caption="Formula · done (✓/✗ while picking; emits on commit)" readout={asText(committed)}>
            <FormulaInput
              value={committed}
              changeOn="done"
              onDone={setCommitted}
              placeholder="=A1*2 …"
            />
          </Labeled>
          <Labeled caption="Reference · done (limit input; multi-range)" readout={asText(reference)}>
            <FormulaInput
              grammar="reference"
              allowMulti
              value={reference}
              changeOn="done"
              onDone={setReference}
            />
          </Labeled>
        </div>
        <div style={{ flex: '1 1 100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Studio workbook={workbook} sx={{ flex: '1 1 100%', minHeight: 0 }} />
        </div>
      </div>
    </WorkbookProvider>
  );
};

export const FormulaInputThirdParty = asStory(Template);
FormulaInputThirdParty.storyName = 'Third-party FormulaInputs (over a Studio)';

const Story = {
  title: 'Editor/FormulaInput (Third-party)',
  component: FormulaInputThirdParty
};
export default Story;
