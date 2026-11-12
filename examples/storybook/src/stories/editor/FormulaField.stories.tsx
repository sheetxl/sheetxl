import React, { useMemo, useState } from 'react';

import { Workbook, type IWorkbook, type ICalculation } from '@sheetxl/sdk';

import { WorkbookElement } from '@sheetxl/react';

import { FormulaField } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/** Show the last emitted value's own text (an `IFormula`), or the seeded string before any edit. */
const asText = (v: ICalculation.IFormula | string | null): string => {
  if (v == null) return '(none)';
  return typeof v === 'string' ? v : v.getExpression();
};

/**
 * The MUI `FormulaField` — the form-shaped (TextField) field — hosted in a plain form OUTSIDE the
 * workbook (the workbook passed by prop; inside a Studio it comes from context instead). **This is
 * the example to copy** for a formula/range field in a MUI app. Two grammars, same component:
 * the default `'formula'` accepts any expression; `grammar="reference"` is the "limit input"
 * (a pure reference list — Excel's RefEdit contract).
 *
 * Try it:
 * - Focus a field, then **drag on the grid** (or pick a **header**) — the reference writes into the
 *   field (always sheet-qualified in the reference field).
 * - **Arrow keys** pick on the displayed sheet; typing or clicking in the text switches arrows back to
 *   the caret (**F2** toggles, **F4** cycles `$`).
 * - Switch **sheet tabs** mid-pick for a cross-sheet reference.
 * - **Enter** commits (back to idle), **Escape** reverts to the value before the pick session —
 *   whether pressed in the field or on the grid; focus always returns to the field.
 * - **Hover** a reference (or any evaluable sub-expression in the formula field) for its value.
 */
const Template: React.FC = () => {
  const workbook: IWorkbook = useMemo(() => {
    const wb = new Workbook();
    wb.addWorksheet('Sheet2');
    const s = wb.getWorksheetAt(0);
    s.getRange('A1:B1').setValues([['Pick', 'me']]);
    s.getRange('B3').setValue(42);
    return wb;
  }, []);
  const [formula, setFormula] = useState<ICalculation.IFormula | string | null>('=B3*2');
  const [reference, setReference] = useState<ICalculation.IFormula | string | null>(null);
  return (
    <div className="storybook-container" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, maxWidth: 880 }}>
        <FormulaField
          value={formula}
          onChangeInput={setFormula}
          workbook={workbook}
        />
        <FormulaField
          grammar="reference"
          value={reference}
          onChangeInput={setReference}
          allowMulti
          workbook={workbook}
        />
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '0 2px' }}>
        formula: {asText(formula)} | reference: {asText(reference)}
      </div>
      <div style={{ flex: '1 1 100%', minHeight: 0 }}>
        <WorkbookElement workbook={workbook} />
      </div>
    </div>
  );
};

export const FormulaFieldStory = asStory(Template);
FormulaFieldStory.storyName = 'FormulaField';

const Story = {
  title: 'Editor/FormulaField',
  component: FormulaFieldStory
};
export default Story;
