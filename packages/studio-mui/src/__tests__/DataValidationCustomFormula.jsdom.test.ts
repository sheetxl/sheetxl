import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IDataValidation, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { toItemsDescriptor } from '../anchorItems';
import { DataValidationItemsDescriptor } from '../dataValidation/DataValidationDetailsPanel';
import { DataValidationEditorPanel } from '../dataValidation/DataValidationEditorPanel';

/**
 * A custom-formula validation authored in the pane, keystroke by keystroke, then saved.
 */
describe('DataValidationEditorPanel custom formula', () => {

  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const descriptor = toItemsDescriptor(DataValidationItemsDescriptor);

  const newWorkbook = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheetAt(0)!;
    sheet.getRange('C5:C7').setValues([[1], ['x'], [3]]);
    sheet.getRange('C5:C7').select();
    return workbook;
  };

  const mount = async (workbook: IWorkbook, dataValidation: IDataValidation) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(DataValidationEditorPanel, { dataValidation })));
    });
    return {
      container,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  /** One keystroke at a time, as a user types: every prefix reaches the model. */
  const typeSlowly = async (container: HTMLElement, text: string): Promise<void> => {
    for (let i=1; i<=text.length; i++) {
      const input = Array.from(container.querySelectorAll('input'))
        .find((el) => el.getAttribute('placeholder') === 'Enter Formula') as HTMLInputElement;
      expect(input, 'formula input').toBeTruthy();
      await act(async () => {
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, text.substring(0, i));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  };

  const formulaInputValue = (container: HTMLElement): string | undefined =>
    (Array.from(container.querySelectorAll('input'))
      .find((el) => el.getAttribute('placeholder') === 'Enter Formula') as HTMLInputElement)?.value;

  it('a new rule typed in the pane flags the cells its formula fails', async () => {
    const workbook = await newWorkbook();
    const draft = descriptor.createDraft!(workbook);
    draft.setCondition({ operator: 'expression', param: '' } as never);
    const panel = await mount(workbook, draft);
    await typeSlowly(panel.container, '=ISNUMBER(C5)');
    expect(formulaInputValue(panel.container)).toBe('=ISNUMBER(C5)');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
    await panel.unmount();

    descriptor.save(workbook, draft, null);
    const saved = workbook.getWorksheetAt(0)!.getDataValidations().getItems()[0];
    expect(saved.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
    await vi.waitFor(() => expect(saved.getAlertAt(5, 2)).toBe(true), { timeout: 3000 });
    expect(saved.getAlertAt(4, 2)).toBe(false);
    expect(saved.getAlertAt(6, 2)).toBe(false);
  });

  it('a leading = typed into the formula is not part of it', async () => {
    const workbook = await newWorkbook();
    const draft = descriptor.createDraft!(workbook);
    draft.setCondition({ operator: 'expression', param: '' } as never);
    const panel = await mount(workbook, draft);
    await typeSlowly(panel.container, '=ISNUMBER(C5)');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
    await panel.unmount();
    descriptor.save(workbook, draft, null);
    const saved = workbook.getWorksheetAt(0)!.getDataValidations().getItems()[0];
    await vi.waitFor(() => expect(saved.getAlertAt(5, 2)).toBe(true), { timeout: 3000 });
    expect(saved.getAlertAt(4, 2)).toBe(false);
  });

  it('text without a = is not a formula and reaches nothing', async () => {
    const workbook = await newWorkbook();
    const draft = descriptor.createDraft!(workbook);
    draft.setCondition({ operator: 'expression', param: '' } as never);
    const panel = await mount(workbook, draft);
    await typeSlowly(panel.container, 'ISNUMBER(C5)');
    expect(formulaInputValue(panel.container)).toBe('ISNUMBER(C5)');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: '' });
    await panel.unmount();
  });

  it('an existing custom rule edited in the pane takes the new formula', async () => {
    const workbook = await newWorkbook();
    const target = workbook.getWorksheetAt(0)!.getDataValidations().add('C5:C7', {
      condition: { operator: 'expression', param: 'ISTEXT(C5)' }
    } as never);
    await vi.waitFor(() => expect(target.getAlertAt(4, 2)).toBe(true), { timeout: 3000 });
    const draft = descriptor.createDraft!(workbook, target);
    const panel = await mount(workbook, draft);
    expect(formulaInputValue(panel.container)).toBe('=ISTEXT(C5)');
    await typeSlowly(panel.container, '=ISNUMBER(C5)');
    await panel.unmount();
    descriptor.save(workbook, draft, target);
    expect(target.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
    await vi.waitFor(() => expect(target.getAlertAt(5, 2)).toBe(true), { timeout: 3000 });
    expect(target.getAlertAt(4, 2)).toBe(false);
  });

  it('reaches Formula from the Allow select, as Excel\'s Custom, and the row is the field alone', async () => {
    const workbook = await newWorkbook();
    const draft = descriptor.createDraft!(workbook);
    const panel = await mount(workbook, draft);
    // The selector row: a formula is a reading, so it is listed with the readings.
    const allow = panel.container.querySelector<HTMLElement>('[role="combobox"]');
    expect(allow, 'Allow select').toBeTruthy();
    await act(async () => {
      allow!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const findItem = () => Array.from(document.querySelectorAll('li'))
      .find((el) => el.textContent?.trim() === 'Formula') as HTMLElement;
    await vi.waitFor(() => expect(findItem(), Array.from(document.querySelectorAll('li')).map((el) => el.textContent).join('|')).toBeTruthy(), { timeout: 2000 });
    const item = findItem();
    await act(async () => { item.click(); });
    expect(draft.getCondition()?.getOperator()?.getName()).toBe('expression');
    expect(allow!.textContent).toBe('Formula');
    // No When select: the operator is settled by the row.
    expect(Array.from(panel.container.querySelectorAll('label')).map((el) => el.textContent?.trim())).not.toContain('When');
    await typeSlowly(panel.container, '=ISNUMBER(C5)');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
    await panel.unmount();
  });

  /* As in Excel's dialogs (CF and DV alike): a relative reference is typed and read at the ACTIVE
     cell, and stored at the rule's anchor, the top-left of its ranges. */
  describe('with the active cell away from the anchor', () => {

    const activeAtC7 = async (): Promise<IWorkbook> => {
      const workbook = await newWorkbook();
      workbook.getWorksheetAt(0)!.getRange('C7').select();
      return workbook;
    };

    it('stores a typed formula at the anchor', async () => {
      const workbook = await activeAtC7();
      const draft = descriptor.createDraft!(workbook);
      draft.setRanges('C5:C7');
      draft.setCondition({ operator: 'expression', param: '' } as never);
      const panel = await mount(workbook, draft);
      await typeSlowly(panel.container, '=ISNUMBER(C7)');
      expect(formulaInputValue(panel.container)).toBe('=ISNUMBER(C7)');
      expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'expression', param: 'ISNUMBER(C5)' });
      await panel.unmount();
      descriptor.save(workbook, draft, null);
      const saved = workbook.getWorksheetAt(0)!.getDataValidations().getItems()[0];
      await vi.waitFor(() => expect(saved.getAlertAt(5, 2)).toBe(true), { timeout: 3000 });
      expect(saved.getAlertAt(4, 2)).toBe(false);
      expect(saved.getAlertAt(6, 2)).toBe(false);
    });

    it('shows a stored formula as it reads at the active cell', async () => {
      const workbook = await activeAtC7();
      const target = workbook.getWorksheetAt(0)!.getDataValidations().add('C5:C7', {
        condition: { operator: 'expression', param: 'AND(ISNUMBER(C5),$A$1="")' }
      } as never);
      const panel = await mount(workbook, descriptor.createDraft!(workbook, target));
      expect(formulaInputValue(panel.container)).toBe('=AND(ISNUMBER(C7),$A$1="")');
      await panel.unmount();
    });

    it('leaves an absolute reference where it is', async () => {
      const workbook = await activeAtC7();
      const draft = descriptor.createDraft!(workbook);
      draft.setRanges('C5:C7');
      draft.setCondition({ operator: 'expression', param: '' } as never);
      const panel = await mount(workbook, draft);
      await typeSlowly(panel.container, '=$C$7>0');
      expect(draft.getCondition()?.toJSON()).toMatchObject({ param: '$C$7>0' });
      await panel.unmount();
    });

  });

});
