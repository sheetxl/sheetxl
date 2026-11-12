import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, ICondition, type IDataValidation, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { toItemsDescriptor } from '../anchorItems';
import { DataValidationItemsDescriptor } from '../dataValidation/DataValidationDetailsPanel';
import { DataValidationEditorPanel } from '../dataValidation/DataValidationEditorPanel';

/**
 * The data-validation editor: one scrolling editor over the shared condition
 * editor, the message sections, and the in-cell dropdown for a rule that offers a list.
 */
describe('DataValidationEditorPanel', () => {

  // The header's chip resolves the color scheme through `prefers-color-scheme`, which this jsdom
  // does not implement.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const newWorkbook = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    return workbook;
  };

  /** A new rule as the pane mints it: a detached draft with the pane's new-rule defaults. */
  const newDraft = (workbook: IWorkbook): IDataValidation =>
    toItemsDescriptor(DataValidationItemsDescriptor).createDraft!(workbook);

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
      text: (): string => container.textContent ?? '',
      /** The checkbox whose label reads `label`. */
      checkbox: (label: string): HTMLInputElement => {
        const owner = Array.from(container.querySelectorAll('label'))
          .find((el) => el.textContent?.trim() === label);
        return owner?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      },
      /** Opens the named tab: Rule, or Prompt. */
      tab: async (label: string): Promise<void> => {
        const el = Array.from(container.querySelectorAll('[role="tab"]')).find((e) => e.textContent?.trim() === label) as HTMLElement;
        expect(el, `the ${label} tab`).toBeTruthy();
        await act(async () => { el.click(); });
      },
      pickType: async (title: string): Promise<void> => {
        const combo = container.querySelector('[role="combobox"]') as HTMLElement;
        await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
        const item = Array.from(document.querySelectorAll('li'))
          .find((li) => li.textContent?.trim() === title) as HTMLElement;
        expect(item, title).toBeTruthy();
        await act(async () => { item.click(); });
      },
      /** The rows of the Allow list, as shown. */
      typeRows: async (): Promise<string[]> => {
        const combo = container.querySelector('[role="combobox"]') as HTMLElement;
        await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
        const rows = Array.from(document.querySelectorAll('li')).map((li) => li.textContent?.trim() ?? '');
        await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        return rows;
      },
      /** The operators the When select offers, in order, by opening it (a rule with an operator). */
      whenRows: async (): Promise<string[]> => {
        const combos = container.querySelectorAll('[role="combobox"]');
        const when = combos[1] as HTMLElement;
        expect(when, 'the When select').toBeTruthy();
        await act(async () => { when.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
        const rows = Array.from(document.querySelectorAll('li'))
          .map((li) => li.textContent?.trim() ?? '').filter((text) => text.length > 0);
        await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        return rows;
      },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('starts a new rule as Excel\'s dialog does: Stop, alert shown', async () => {
    const draft = newDraft(await newWorkbook());
    expect(draft.getAlertStyle()).toBe('stop');
    expect(draft.isShowAlertMessage()).toBe(true);
    expect(draft.getCondition()).toBeNull();
  });

  it('lets blanks through once a new rule is given a type', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    const panel = await mount(workbook, draft);
    await panel.pickType('Whole');
    expect(draft.getCondition()?.getOperator()?.getName()).toBe(ICondition.BuiltInOperatorNames.Between);
    expect(draft.getCondition()?.isIncludeBlanks()).toBe(true);
    expect(panel.checkbox('Ignore Blank').checked).toBe(true);
    await panel.unmount();
  });

  it('Allow lists the selectors only: no List row, and a set reads as Any', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    // The ribbon's List… command mints this: any value, one of a set.
    draft.setCondition({ operator: 'inSet', param: { additions: ['a', 'b'] }, includeBlanks: true } as never);
    const panel = await mount(workbook, draft);
    expect(panel.container.querySelector('[role="combobox"]')?.textContent).toBe('Any');
    const rows = await panel.typeRows();
    expect(rows).not.toContain('List');
    expect(rows).toContain('Any');
    expect(rows).toContain('Whole');
    expect(rows).toContain('Display');
    // Its source field is the first field: where the cursor lands after a choice.
    expect(panel.container.querySelector('input[placeholder="Values"]')).toBeTruthy();
    await panel.unmount();
  });

  it('Formula is a row under Allow, not under When, and leaving it starts the new type afresh', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ operator: 'inSet', param: { additions: ['a'] } } as never);
    // One menu per mount: a menu closed by Escape is still in the document for a tick.
    const whenPanel = await mount(workbook, draft);
    expect(await whenPanel.whenRows()).not.toContain('Formula');
    await whenPanel.unmount();
    const typePanel = await mount(workbook, draft);
    expect(await typePanel.typeRows()).toContain('Formula');
    await typePanel.unmount();

    const stored = workbook.getWorksheetAt(0)!.getDataValidations().add('D1', {
      condition: { operator: 'expression', param: 'ISNUMBER(D1)' }
    } as never);
    const opened = await mount(workbook, toItemsDescriptor(DataValidationItemsDescriptor).createDraft!(workbook, stored));
    expect(opened.container.querySelector('[role="combobox"]')?.textContent).toBe('Formula');
    expect(Array.from(opened.container.querySelectorAll('label')).map((el) => el.textContent?.trim())).not.toContain('When');
    await opened.unmount();
  });

  it('keeps a set across a change of type: a whole number, one of a and b', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ operator: 'inSet', param: { additions: ['a', 'b'] } } as never);
    const panel = await mount(workbook, draft);
    // Membership is offered under every selector, so the set is kept and read as the type reads.
    await panel.pickType('Whole');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ selector: 'wholeNumber', operator: 'inSet', param: { additions: ['a', 'b'] } });
    // And back to Any: the list as it was left.
    await panel.pickType('Any');
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'inSet', param: { additions: ['a', 'b'] } });
    expect(draft.getCondition()?.getSelector()).toBeNull();
    await panel.unmount();
  });

  it('lists "List" first under Any, and among the rest under a type', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ operator: 'equalTo', param: 1 } as never);
    const panel = await mount(workbook, draft);
    const underAny = await panel.whenRows();
    expect(underAny.indexOf('List')).toBe(underAny.indexOf('Basic') + 1);
    await act(async () => { draft.setCondition({ selector: 'wholeNumber', operator: 'equalTo', param: 1 } as never); });
    // Offered under a type as well, in its place among the rest.
    const underWhole = await panel.whenRows();
    expect(underWhole).toContain('List');
    await panel.unmount();
  });

  it('offers membership under a type: a whole number, one of a set', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ selector: 'wholeNumber', operator: 'inSet', param: { items: [1, 2, 3] } } as never);
    const panel = await mount(workbook, draft);
    // A type with a set is that type, not the List preset, and it offers the dropdown too.
    expect(panel.container.querySelector('[role="combobox"]')?.textContent).not.toBe('List');
    expect(panel.checkbox('In-cell dropdown')?.checked).toBe(true);
    await panel.unmount();
  });

  it('offers the in-cell dropdown only for a rule that offers a list', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ operator: 'inSet', param: { items: ['a', 'b'] } } as never);
    const panel = await mount(workbook, draft);
    const dropdown = panel.checkbox('In-cell dropdown');
    expect(dropdown?.checked).toBe(true);
    await act(async () => { dropdown.click(); });
    expect(draft.isHideDropdown()).toBe(true);

    await act(async () => {
      draft.setCondition({ selector: 'wholeNumber', operator: 'between', param: { from: 1, to: 5 } } as never);
    });
    expect(panel.checkbox('In-cell dropdown')).toBeFalsy();
    await panel.unmount();
  });

  it('shows each message from its section\'s header, on and off again', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    const panel = await mount(workbook, draft);
    // The alert is the rule's, one choice of what an invalid entry gets; the prompt has a tab of its own.
    expect(draft.isShowAlertMessage()).toBe(true);
    const choose = async (label: string): Promise<void> => {
      const select = panel.container.querySelector('.on-invalid [role="combobox"]') as HTMLElement;
      expect(select, 'the Invalid select').toBeTruthy();
      await act(async () => { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
      const item = Array.from(document.querySelectorAll('li')).find((el) => el.textContent?.trim() === label) as HTMLElement;
      expect(item, label).toBeTruthy();
      await act(async () => { item.click(); });
    };
    await choose('Accept silently');
    expect(draft.isShowAlertMessage()).toBe(false);
    expect(panel.container.querySelector('input[maxlength="32"]')).toBeNull();
    await choose('Warning');
    expect(draft.isShowAlertMessage()).toBe(true);
    expect(draft.getAlertStyle()).toBe('warning');
    const showPrompt = 'Show when the cell is selected';
    expect(panel.checkbox(showPrompt)).toBeFalsy();
    await panel.tab('Prompt');
    expect(draft.isShowPromptMessage()).toBe(false);
    await act(async () => { panel.checkbox(showPrompt).click(); });
    expect(draft.isShowPromptMessage()).toBe(true);
    await act(async () => { panel.checkbox(showPrompt).click(); });
    expect(draft.isShowPromptMessage()).toBe(false);
    await panel.unmount();
  });

  it('leaving a combinator for a comparison starts the comparison afresh', async () => {
    const workbook = await newWorkbook();
    const draft = newDraft(workbook);
    draft.setCondition({ selector: 'date', operator: 'and', param: [{ operator: 'after', param: 1 }] } as never);
    const panel = await mount(workbook, draft);
    const combos = panel.container.querySelectorAll('[role="combobox"]');
    const when = combos[1] as HTMLElement;
    await act(async () => { when.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
    const item = Array.from(document.querySelectorAll('li')).find((el) => el.textContent?.trim() === 'Equal To') as HTMLElement;
    expect(item, 'Equal To').toBeTruthy();
    await act(async () => { item.click(); });
    expect(draft.getCondition()?.toJSON()).toMatchObject({ operator: 'equalTo' });
    expect(draft.getCondition()?.getParam() ?? null).toBeNull();
    const field = panel.container.querySelector('input[placeholder="Enter Value or Formula"]') as HTMLInputElement;
    expect(field?.value).toBe('');
    await panel.unmount();
  });

  it('holds titles and messages to Excel\'s authoring lengths', async () => {
    const workbook = await newWorkbook();
    const panel = await mount(workbook, newDraft(workbook));
    const lengths = (selector: string): number[] => Array.from(panel.container.querySelectorAll(selector))
      .map((el) => Number(el.getAttribute('maxlength'))).filter((n) => n > 0).sort((a, b) => a - b);
    expect(lengths('input')).toEqual([32]);
    expect(lengths('textarea')).toEqual([225]);
    await panel.tab('Prompt');
    expect(lengths('input')).toEqual([32]);
    expect(lengths('textarea')).toEqual([254]);
    await panel.unmount();
  });

});
