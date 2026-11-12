import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ThemeProvider } from '@mui/material';

import { Workbook, ICondition, type ITable, type IWorkbook } from '@sheetxl/sdk';

import { Viewport, type FloatReference } from '@sheetxl/utils-react';

import { createExhibitTheme } from '@sheetxl/utils-mui';

import { WorkbookProvider } from '@sheetxl/react';

import { ColumnMenu } from '../filter/ColumnMenu';

/**
 * The column filter menu, a template menu: opening on Values with the
 * checklist, what Apply writes, the (Blank) row and Ignore Blank, the date tree, the "By value"
 * option, the Values / kind / Custom modes and what each keeps, the When menu's sections by the
 * column's kind, and the When menu staying with its host float.
 */
describe('ColumnMenu', () => {
  beforeAll(() => {
    if (typeof window.matchMedia !== 'function') {
      (window as any).matchMedia = (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
      });
    }
    // The editor measures its box; jsdom has no `ResizeObserver`, so one reporting a fixed box stands in.
    if (typeof (globalThis as any).ResizeObserver !== 'function') {
      (globalThis as any).ResizeObserver = class {
        private _cb: (entries: unknown[]) => void;
        constructor(cb: (entries: unknown[]) => void) { this._cb = cb; }
        observe(): void { this._cb([{ contentRect: { width: 300, height: 220 } }]); }
        unobserve(): void {}
        disconnect(): void {}
      };
    }
  });

  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  // The app's theme: it is what keeps a Select's menu from dismissing the float that hosts the menu.
  const theme = createExhibitTheme(false);

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    // A presets panel left open is a float in the body.
    document.body.innerHTML = '';
  });

  const createTable = async (): Promise<{ workbook: IWorkbook; table: ITable }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:B5').setValues([
      ['Column1', 'Column2'],
      ['A', 'a'],
      ['B', 'b'],
      ['C', null],
      ['D', 'a']
    ]);
    // Said outright: an all-text column reads as headerless to the guess, which would insert a row.
    return { workbook, table: sheet.getTables().add('A1:B5', { hasHeader: true }) };
  };

  /** A one-column table of the numbers 1 to 5, and a blank. */
  const createNumbered = async (): Promise<{ workbook: IWorkbook; table: ITable }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:A7').setValues([['N'], [1], [2], [3], [4], [5], [null]]);
    return { workbook, table: sheet.getTables().add('A1:A7', { hasHeader: true }) };
  };

  const hiddenRows = (workbook: IWorkbook, count: number = 7): number[] => {
    const headers = workbook.getSelectedWorksheet().getRowHeaders();
    const hidden: number[] = [];
    for (let i=0; i<count; i++) if (headers.at(i).isHidden()) hidden.push(i);
    return hidden;
  };

  const settle = async (ms: number = 30): Promise<void> => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
  };

  const mount = async (table: ITable, floatReference: FloatReference, columnIndex: number = 1): Promise<void> => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    // jsdom measures nothing: the list is told its box, so its rows render.
    const viewport = new Viewport();
    viewport.setSizes(260, 200, 260, 200);
    await act(async () => {
      root!.render(createElement(ThemeProvider as never, { theme } as never,
        createElement(WorkbookProvider as never, { workbook: table.getRange().getWorksheet().getWorkbook() } as never,
          createElement(ColumnMenu as never, {
            column: table.getColumnAt(columnIndex)!, floatReference, propsChecklist: { viewport }
          } as never))));
    });
    await settle(50);
  };

  /** The Values list in view: it stays mounted, hidden, under the rule modes. */
  const values = '.filter-values:not(.hidden)';
  /** The rule editor: one is mounted at a time, in the kind's mode or Custom. */
  const shown = '.filter-editor';
  const boxes = (): HTMLInputElement[] => Array.from(host!.querySelectorAll(`${values} .sxl-list-surface input[type="checkbox"]`)) as HTMLInputElement[];
  const rows = (): string[] => boxes().map((box) => (box.parentElement!.parentElement!.textContent ?? '').trim());
  const checkedRows = (): string[] => boxes().filter((box) => box.checked).map((box) => (box.parentElement!.parentElement!.textContent ?? '').trim());
  const rowEl = (index: number): HTMLElement => boxes()[index].parentElement!.parentElement!;
  const button = (label: string): HTMLButtonElement =>
    Array.from(host!.querySelectorAll('button')).find((el) => el.textContent === label) as HTMLButtonElement;
  const click = async (el: Element): Promise<void> => {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    await settle(50);
  };
  const mouseDown = async (el: Element): Promise<void> => {
    await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
  };
  const typeInto = async (el: HTMLInputElement, text: string): Promise<void> => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
  };
  const type = async (text: string): Promise<void> => {
    await typeInto(host!.querySelector(`${values} input[role="searchbox"]`) as HTMLInputElement, text);
  };
  const closeAllRef = (): FloatReference => ({ closeAll: vi.fn() } as unknown as FloatReference);
  /** The condition's Ignore Blank checkbox, under a rule editor; none under Values. */
  const ignoreBlank = (): HTMLInputElement => host!.querySelector(`${shown} .include-blanks input[type="checkbox"]`) as HTMLInputElement;
  /** The mode toggle's pressed button, by value. */
  const activeMode = (): string | null =>
    host!.querySelector('.filter-mode button[aria-pressed="true"]')?.getAttribute('value') ?? null;
  const modeLabels = (): string[] => Array.from(host!.querySelectorAll('.filter-mode button')).map((el) => el.textContent ?? '');
  const switchMode = async (value: 'values' | 'family' | 'custom'): Promise<void> => {
    await click(host!.querySelector(`.filter-mode button[value="${value}"]`)!);
    await settle(100);
  };
  /** The editor's When select; none in Values mode. */
  const whenSelect = (): HTMLElement => host!.querySelector(`${shown} [role="combobox"]`) as HTMLElement;
  /** The When menu's sections as opened, each its header followed by its options; then closes it. */
  const whenMenu = async (): Promise<string[][]> => {
    await mouseDown(whenSelect());
    await settle(50);
    const listbox = document.querySelector('[role="listbox"]')!;
    const sections: string[][] = [];
    for (const el of Array.from(listbox.children)) {
      // A Select stamps `role="option"` on every child, its dividers included.
      if (el.classList.contains('MuiListSubheader-root')) sections.push([el.textContent ?? '']);
      else if (el.getAttribute('role') === 'option' && !el.classList.contains('MuiDivider-root')) sections[sections.length - 1]?.push(el.textContent ?? '');
    }
    await act(async () => { listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    await settle(50);
    return sections;
  };
  /** Chooses an operator in the When select. */
  const pickWhen = async (title: string): Promise<void> => {
    await mouseDown(whenSelect());
    await settle(50);
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const option = options.find((el) => el.textContent === title) as HTMLElement;
    expect(option, `${title} (saw: ${options.map((el) => el.textContent).join(', ')})`).toBeTruthy();
    await click(option);
  };
  /** The root rule's remove button, which a filter's menu does not draw. */
  const removeRule = (): HTMLElement | null => host!.querySelector(`${shown} [role="button"]`);
  /** The editor's first operand field. */
  const operandField = (): HTMLInputElement =>
    Array.from(host!.querySelectorAll<HTMLInputElement>(`${shown} input:not([type="checkbox"]):not([tabindex="-1"])`))
      .find((el) => el.getAttribute('aria-hidden') !== 'true') as HTMLInputElement;

  it('opens on Values: the data rows\' distinct values and the blank, everything checked, the list alone', async () => {
    const { table } = await createTable();
    await mount(table, closeAllRef());
    // A blank is a value: its row is last.
    expect(rows()).toEqual(['a', 'b', '(Blank)']);
    expect(checkedRows()).toEqual(['a', 'b', '(Blank)']);
    // Values mode: the checklist and nothing around it; no When, no Ignore Blank (the (Blank) row
    // is the blank's say). The kind's mode is named by the column's kind.
    expect(activeMode()).toBe('values');
    expect(modeLabels()).toEqual(['Values', 'Text', 'Custom']);
    expect(whenSelect()).toBeNull();
    expect(host!.querySelector('.include-blanks')).toBeNull();
    // The focus is on the list, not the search field: the arrows, Space and Enter work at once.
    expect(host!.querySelector('.filter-values')!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement!.getAttribute('role')).not.toBe('searchbox');
  });

  it('Enter on the Values list applies', async () => {
    const { workbook, table } = await createTable();
    const floatReference = closeAllRef();
    await mount(table, floatReference);
    await mouseDown(rowEl(0)); // a off
    const list = document.activeElement as HTMLElement;
    expect(host!.querySelector('.filter-values')!.contains(list)).toBe(true);
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await settle(100);
    expect(table.getColumnAt(1)!.getFilter()!.getCondition()!.toJSON().param).toEqual({ items: ['b'], blank: true });
    expect(hiddenRows(workbook)).toEqual([1, 4]);
    expect(floatReference.closeAll).toHaveBeenCalled();
  });

  it('a column with no condition leaves out the values of hidden rows', async () => {
    const { workbook, table } = await createTable();
    workbook.getSelectedWorksheet().getRowHeaders().getRange({ min: 2, max: 3 }).setHidden(true); // `b` and the blank
    await mount(table, closeAllRef());
    expect(rows()).toEqual(['a']);
    expect(checkedRows()).toEqual(['a']);
  });

  it('a column with a condition lists every value, the hidden ones unchecked', async () => {
    const { table } = await createTable();
    await table.getColumnAt(1)!.getFilter()!.setCondition({ selector: 'display', operator: 'inSet', param: { items: ['b'] } });
    await mount(table, closeAllRef());
    expect(rows()).toEqual(['a', 'b', '(Blank)']);
    expect(checkedRows()).toEqual(['b']);
  });

  it('Apply with everything checked, the blank included, writes no filter', async () => {
    const { workbook, table } = await createTable();
    const floatReference = closeAllRef();
    await mount(table, floatReference);
    await click(button('Apply'));

    // Every value and the blanks is no filter at all (Excel's Select All).
    expect(table.getColumnAt(1)!.getFilter()!.getCondition()).toBeNull();
    expect(hiddenRows(workbook)).toEqual([]);
    expect(floatReference.closeAll).toHaveBeenCalled();
  });

  it('Select All, the blank with it, then Apply, clears the column\'s filter', async () => {
    const { workbook, table } = await createTable();
    await table.getColumnAt(1)!.getFilter()!.setCondition({ selector: 'display', operator: 'inSet', param: { items: ['b'] } });
    expect(hiddenRows(workbook).length).toBeGreaterThan(0);
    await mount(table, closeAllRef());
    await mouseDown(host!.querySelector('.sxl-select-all')!);
    expect(checkedRows()).toEqual(['a', 'b', '(Blank)']);
    await click(button('Apply'));

    expect(table.getColumnAt(1)!.getFilter()!.getCondition()).toBeNull();
    expect(hiddenRows(workbook)).toEqual([]);
  });

  it('every value checked with the blank unchecked is still a filter', async () => {
    const { workbook, table } = await createTable();
    await mount(table, closeAllRef());
    await mouseDown(rowEl(2)); // (Blank)
    await click(button('Apply'));

    const condition = table.getColumnAt(1)!.getFilter()!.getCondition()!;
    expect(condition.getOperator()!.getName()).toBe(ICondition.BuiltInOperatorNames.InSet);
    expect(condition.isIncludeBlanks()).toBe(false);
    // The blank is not a member. Read as the column shows its cells: the Display selector.
    expect(condition.toJSON().param).toEqual({ items: ['a', 'b'] });
    expect(condition.getSelector()!.getName()).toBe('display');
    expect(hiddenRows(workbook)).toEqual([3]);
  });

  it('a condition reopens with its blank member checked', async () => {
    const { table } = await createTable();
    await table.getColumnAt(1)!.getFilter()!.setCondition({ selector: 'display', operator: 'inSet', param: { items: ['a'], blank: true } });
    await mount(table, closeAllRef());
    expect(checkedRows()).toEqual(['a', '(Blank)']);
  });

  it('Cancel writes nothing', async () => {
    const { table } = await createTable();
    const floatReference = closeAllRef();
    await mount(table, floatReference);
    await mouseDown(rowEl(1));
    await click(button('Cancel'));
    expect(table.getColumnAt(1)!.getFilter()!.getCondition()).toBeNull();
    expect(floatReference.closeAll).toHaveBeenCalled();
  });

  it('By value lists values once and Apply writes them typed', async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:A6').setValues([['Ones'], [1], [1], [2], [2], ["'1"]]);
    sheet.getRange('A2').setNumberFormat('$0');
    sheet.getRange('A4').setNumberFormat('0.00');
    const table = sheet.getTables().add('A1:A6', { hasHeader: true });
    await mount(table, closeAllRef(), 0);
    expect(rows()).toEqual(['$1', '1', '2', '2.00']); // by display: the text `'1` folds into `1`

    // By value is an option in the menu under the search glyph.
    await click(host!.querySelector(`${values} .sxl-search-options`)!);
    await click(host!.querySelector('.sxl-by-value input')!);
    expect(rows()).toEqual(['1', '2', '1']); // the numbers 1 and 2, then the text 1
    await mouseDown(rowEl(1)); // the number 2 off
    await click(button('Apply'));

    const condition = table.getColumnAt(0)!.getFilter()!.getCondition()!;
    const param = condition.getParam() as ICondition.InSetOption;
    // By value is no selector: the values themselves.
    expect(condition.getSelector()).toBeNull();
    expect(param.items).toEqual([1, '1']);
    expect(hiddenRows(workbook)).toEqual([3, 4]);
  });

  describe('the modes', () => {

    it('the kind opens on the text family\'s first operator and lists the family alone; Custom lists it first', async () => {
      const { table } = await createTable();
      await mount(table, closeAllRef());
      await switchMode('family');
      expect(activeMode()).toBe('family');
      // The checklist gives way to the operand, with the cursor in it, and Ignore Blank under it.
      expect(rows()).toEqual([]);
      expect(whenSelect().textContent).toBe('Equal To');
      expect(document.activeElement).toBe(operandField());
      expect(ignoreBlank().checked).toBe(false);
      // The registry's text operators: Excel's four first, in Excel's order, the rest by title.
      expect(await whenMenu()).toEqual([
        ['Text Filters', 'Equal To', 'Starts With', 'Ends With', 'Contains', 'Is Email', 'Is URL', 'Matches']
      ]);
      await switchMode('custom');
      expect(whenSelect().textContent).toBe('Equal To');
      // Custom is the whole registry: the family first, then every other operator, List, Formula
      // and Unique among them, then the combinators.
      expect(await whenMenu()).toEqual([
        ['Text Filters', 'Equal To', 'Starts With', 'Ends With', 'Contains', 'Is Email', 'Is URL', 'Matches'],
        ['Basic', 'After', 'After or On', 'Average', 'Before', 'Before or On', 'Between', 'Blank', 'Error', 'Formula',
          'Greater Than', 'Greater Than or Equal To', 'Less Than', 'Less Than Or Equal To', 'List', 'Time Period', 'Top N', 'Unique'],
        ['Combine', 'And', 'Not', 'Or']
      ]);
    });

    it('List under Custom is the column\'s checklist, read under Display', async () => {
      const { table } = await createTable();
      await mount(table, closeAllRef());
      await switchMode('custom');
      await pickWhen('List');
      await settle(100);
      expect(whenSelect().textContent).toBe('List');
      const listed = Array.from(host!.querySelectorAll(`${shown} .sxl-list-surface input[type="checkbox"]`))
        .map((box) => (box.parentElement!.parentElement!.textContent ?? '').trim());
      expect(listed).toEqual(['a', 'b', '(Blank)']);
    });

    it('an operator chosen in When has an empty operand; Apply writes it', async () => {
      const { workbook, table } = await createTable();
      const floatReference = closeAllRef();
      await mount(table, floatReference);
      await switchMode('family');
      await pickWhen('Contains');
      await settle(50);
      expect(whenSelect().textContent).toBe('Contains');
      const field = operandField();
      expect(field.value).toBe('');
      // Nothing to apply until the operand is typed: Apply leaves the menu open on the rule.
      expect(button('Apply').disabled).toBe(false);
      await click(button('Apply'));
      expect(table.getColumnAt(1)!.getFilter()!.getCondition()).toBeNull();
      expect(floatReference.closeAll).not.toHaveBeenCalled();

      await typeInto(field, 'a');
      await click(button('Apply'));
      expect(table.getColumnAt(1)!.getFilter()!.getCondition()!.toJSON()).toMatchObject({ operator: 'textContains', param: 'a' });
      expect(hiddenRows(workbook)).toEqual([2, 3]);
      expect(floatReference.closeAll).toHaveBeenCalled();
    });

    it('the root rule has no X and no label; Values is the way back, everything checked', async () => {
      const { table } = await createTable();
      const floatReference = closeAllRef();
      await mount(table, floatReference);
      expect(removeRule()).toBeNull();
      await switchMode('family');
      await pickWhen('Starts With');
      await settle(50);
      expect((host!.querySelector(`${shown} label`)?.textContent ?? '').trim()).toBe('');
      expect(rows()).toEqual([]);
      expect(removeRule()).toBeNull();
      await switchMode('values');
      expect(whenSelect()).toBeNull();
      expect(checkedRows()).toEqual(['a', 'b', '(Blank)']);
      expect(table.getColumnAt(1)!.getFilter()!.getCondition()).toBeNull();
      expect(floatReference.closeAll).not.toHaveBeenCalled();
    });

    it('a comparison reopens on the kind; a number column is Number and lists the number family', async () => {
      const { workbook, table } = await createNumbered();
      await table.getColumnAt(0)!.getFilter()!.setCondition({ operator: 'greaterThan', param: 2 });
      expect(hiddenRows(workbook)).toEqual([1, 2, 6]);
      await mount(table, closeAllRef(), 0);
      expect(activeMode()).toBe('family');
      expect(modeLabels()).toEqual(['Values', 'Number', 'Custom']);
      expect(whenSelect().textContent).toBe('Greater Than');
      expect(operandField().value).toBe('2');
      // Excel's eight first, in Excel's order; Time Period reads a serial too, so it follows.
      expect(await whenMenu()).toEqual([
        ['Number Filters', 'Equal To', 'Greater Than', 'Greater Than or Equal To', 'Less Than', 'Less Than Or Equal To', 'Between', 'Top N', 'Average', 'Time Period']
      ]);
    });

    it('each mode keeps what it held while the menu is open; Custom starts from the kind\'s rule', async () => {
      const { table } = await createTable();
      await mount(table, closeAllRef());
      await mouseDown(rowEl(0)); // a off
      await switchMode('family');
      await pickWhen('Contains');
      await settle(50);
      await typeInto(operandField(), 'a');
      await switchMode('values');
      expect(checkedRows()).toEqual(['b', '(Blank)']);
      await switchMode('family');
      expect(whenSelect().textContent).toBe('Contains');
      expect(operandField().value).toBe('a');
      await switchMode('custom');
      expect(whenSelect().textContent).toBe('Contains');
      expect(operandField().value).toBe('a');
      await pickWhen('Blank');
      await settle(50);
      await switchMode('family');
      expect(whenSelect().textContent).toBe('Contains');
      await switchMode('custom');
      expect(whenSelect().textContent).toBe('Blank');
    });

    it('Apply with the rule untouched leaves the comparison as it is', async () => {
      const { workbook, table } = await createNumbered();
      const filter = table.getColumnAt(0)!.getFilter()!;
      await filter.setCondition({ operator: 'greaterThan', param: 2 });
      const floatReference = closeAllRef();
      await mount(table, floatReference, 0);
      await click(button('Apply'));
      expect(filter.getCondition()!.toJSON()).toEqual({ operator: 'greaterThan', param: 2 });
      expect(hiddenRows(workbook)).toEqual([1, 2, 6]);
      expect(floatReference.closeAll).toHaveBeenCalled();
    });

    it('Values under a comparison lists the passing values checked; a touch and Apply write the list', async () => {
      const { workbook, table } = await createNumbered();
      const filter = table.getColumnAt(0)!.getFilter()!;
      await filter.setCondition({ operator: 'greaterThan', param: 2 });
      await mount(table, closeAllRef(), 0);
      await switchMode('values');
      // The checklist is a view of the column under the condition: the rows it passes are checked.
      expect(rows()).toEqual(['1', '2', '3', '4', '5', '(Blank)']);
      expect(checkedRows()).toEqual(['3', '4', '5']);
      await mouseDown(rowEl(4)); // 5 off
      await click(button('Apply'));
      const condition = filter.getCondition()!;
      expect(condition.getOperator()!.getName()).toBe(ICondition.BuiltInOperatorNames.InSet);
      expect(condition.getSelector()!.getName()).toBe('display');
      expect(condition.toJSON().param).toEqual({ items: ['3', '4'] });
      expect(hiddenRows(workbook)).toEqual([1, 2, 5, 6]);
    });

    it('Ignore Blank on a comparison keeps the blank rows', async () => {
      const { workbook, table } = await createNumbered();
      const filter = table.getColumnAt(0)!.getFilter()!;
      await filter.setCondition({ operator: 'greaterThan', param: 2 });
      await mount(table, closeAllRef(), 0);
      await click(ignoreBlank());
      await click(button('Apply'));
      expect(filter.getCondition()!.toJSON()).toEqual({ operator: 'greaterThan', param: 2, includeBlanks: true });
      expect(hiddenRows(workbook)).toEqual([1, 2]);
    });

    it('Apply commits an operand typed but not yet entered, as the panes\' Save does', async () => {
      const { workbook, table } = await createNumbered();
      const floatReference = closeAllRef();
      await mount(table, floatReference, 0);
      await switchMode('family');
      expect(whenSelect().textContent).toBe('Equal To');
      // Typed, no Enter, no ✓: the field still holds it when Apply is pressed.
      await typeInto(operandField(), '3');
      await click(button('Apply'));
      expect(table.getColumnAt(0)!.getFilter()!.getCondition()!.toJSON()).toMatchObject({ operator: 'equalTo', param: 3 });
      expect(hiddenRows(workbook)).toEqual([1, 2, 4, 5, 6]);
      expect(floatReference.closeAll).toHaveBeenCalled();
    });

    it('another comparison chosen over a stored one keeps its operand, as the editor does everywhere', async () => {
      const { table } = await createNumbered();
      await table.getColumnAt(0)!.getFilter()!.setCondition({ operator: 'greaterThan', param: 2 });
      await mount(table, closeAllRef(), 0);
      expect(whenSelect().textContent).toBe('Greater Than');
      expect(operandField().value).toBe('2');
      await pickWhen('Less Than');
      await settle(50);
      expect(whenSelect().textContent).toBe('Less Than');
      expect(operandField().value).toBe('2');
    });

    it('a combinator reopens on Custom, on itself; the kind then starts fresh', async () => {
      const { table } = await createNumbered();
      await table.getColumnAt(0)!.getFilter()!.setCondition({
        operator: 'and', param: [{ operator: 'greaterThan', param: 1 }, { operator: 'lessThan', param: 5 }]
      });
      await mount(table, closeAllRef(), 0);
      expect(activeMode()).toBe('custom');
      expect(whenSelect().textContent).toBe('And');
      await switchMode('family');
      expect(whenSelect().textContent).toBe('Equal To');
      expect(operandField().value).toBe('');
    });
  });

  /**
   * The menu lives in a float that closes on any mousedown outside itself, and the editor's When
   * select's menu portals out of it. The theme keeps a press in that menu from reaching the
   * document, so the float's light-dismiss listener never sees it (the hosts' `useFloatStack`).
   */
  it('a press in the When menu never reaches the document', async () => {
    const { table } = await createTable();
    await mount(table, closeAllRef());
    await switchMode('custom');
    const atDocument = vi.fn();
    document.addEventListener('mousedown', atDocument);
    try {
      await mouseDown(whenSelect());
      await settle(50);
      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox).not.toBeNull();
      expect(host!.contains(listbox!)).toBe(false); // portaled: out of the menu, where a float would see it

      atDocument.mockClear(); // the press that opened it was inside the menu
      const option = Array.from(listbox!.querySelectorAll('[role="option"]')).find((el) => el.textContent === 'Blank')!;
      await mouseDown(option);
      expect(atDocument).not.toHaveBeenCalled();

      // The menu still works as a menu: the option chosen becomes the operator.
      await click(option);
      expect(whenSelect().textContent).toBe('Blank');
    } finally {
      document.removeEventListener('mousedown', atDocument);
    }
  });

  /** A one-column table: four dates under `m/d/yyyy` and a number. */
  const createDated = async (): Promise<{ workbook: IWorkbook; table: ITable }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:A6').setValues([
      ['When'], ['=DATE(1996,11,20)'], ['=DATE(1995,10,1)'], ['=DATE(1995,11,15)'], ['=DATE(1994,11,5)'], [7]
    ]);
    sheet.getRange('A2:A5').setNumberFormat('m/d/yyyy');
    const table = sheet.getTables().add('A1:A6', { hasHeader: true });
    await workbook.whenCalculationReady();
    return { workbook, table };
  };

  it('lists a date column as a tree, and Apply writes the checked years as date groups', async () => {
    const { workbook, table } = await createDated();
    await mount(table, closeAllRef(), 0);
    expect(rows()).toEqual(['1996', '1995', '1994', '7']);

    await mouseDown(rowEl(2)); // 1994 off
    await click(button('Apply'));

    const param = table.getColumnAt(0)!.getFilter()!.getCondition()!.getParam() as ICondition.InSetOption;
    expect(param.dateGroups).toEqual([{ group: 'year', year: 1996 }, { group: 'year', year: 1995 }]);
    expect(param.items).toEqual(['7']);
    expect(hiddenRows(workbook)).toEqual([4]);
  });

  it('a date column lists the date family first, read under the Date selector', async () => {
    const { table } = await createDated();
    await mount(table, closeAllRef(), 0);
    expect(modeLabels()).toEqual(['Values', 'Date', 'Custom']);
    await switchMode('family');
    expect(whenSelect().textContent).toBe('After');
    // A date operand: the literal-or-formula field, reading its literal as a date.
    expect(host!.querySelector('.filter-editor input[placeholder="Enter Value or Formula"]')).toBeTruthy();
    const dateFamily = ['Date Filters', 'After', 'Before', 'Between', 'Time Period', 'After or On', 'Before or On', 'Equal To'];
    expect(await whenMenu()).toEqual([dateFamily]);
    await switchMode('custom');
    const sections = await whenMenu();
    expect(sections[0]).toEqual(dateFamily);
    // Between and Equal To are listed once, with their family; the rest of the registry follows.
    expect(sections[1]).toEqual(['Basic', 'Average', 'Blank', 'Contains', 'Ends With', 'Error', 'Formula', 'Greater Than',
      'Greater Than or Equal To', 'Is Email', 'Is URL', 'Less Than', 'Less Than Or Equal To', 'List', 'Matches', 'Starts With', 'Top N', 'Unique']);
    // A date comparison chosen from When reads under Date too.
    await pickWhen('Before');
    await settle(50);
    expect(whenSelect().textContent).toBe('Before');
    expect(host!.querySelector('.filter-editor input[placeholder="Enter Value or Formula"]')).toBeTruthy();
  });

  it('a year checked in part is written at the level that is whole', async () => {
    const { workbook, table } = await createDated();
    await mount(table, closeAllRef(), 0);
    await type('11/15');
    expect(rows()).toEqual(['11/15/1995']);
    await mouseDown(rowEl(0));
    await type('');
    await click(button('Apply'));

    const param = table.getColumnAt(0)!.getFilter()!.getCondition()!.getParam() as ICondition.InSetOption;
    expect(param.dateGroups).toEqual([
      { group: 'year', year: 1996 }, { group: 'month', year: 1995, month: 10 }, { group: 'year', year: 1994 }
    ]);
    expect(hiddenRows(workbook)).toEqual([3]);
  });

  it('a date under two formats is two items on one day; the one left checked is written as its text', async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:A4').setValues([['When'], ['=DATE(1995,10,1)'], ['=DATE(1995,10,1)'], ['=DATE(1996,11,20)']]);
    sheet.getRange('A2').setNumberFormat('m/d/yyyy');
    sheet.getRange('A3').setNumberFormat('d-mmm-yy');
    sheet.getRange('A4').setNumberFormat('m/d/yyyy');
    const table = sheet.getTables().add('A1:A4', { hasHeader: true });
    await workbook.whenCalculationReady();
    await mount(table, closeAllRef(), 0);
    expect(rows()).toEqual(['1996', '1995']);

    await type('Oct');
    expect(rows()).toEqual(['1-Oct-95']);
    await mouseDown(rowEl(0)); // off
    await type('');
    await click(button('Apply'));

    const param = table.getColumnAt(0)!.getFilter()!.getCondition()!.getParam() as ICondition.InSetOption;
    expect(param.dateGroups).toEqual([{ group: 'year', year: 1996 }]);
    expect(param.items).toEqual(['10/1/1995']);
    expect(hiddenRows(workbook)).toEqual([2]);
  });
});
