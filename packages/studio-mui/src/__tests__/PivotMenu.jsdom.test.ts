import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ThemeProvider } from '@mui/material';

import { Workbook, IPivotTable } from '@sheetxl/sdk';

import { Viewport, type FloatReference } from '@sheetxl/utils-react';

import { createExhibitTheme } from '@sheetxl/utils-mui';

import { WorkbookProvider } from '@sheetxl/react';

import { PivotMenu } from '../filter/PivotMenu';

/**
 * A pivot table field's dropdown menu: the column menu's checklist over the field's items, what
 * Apply asks of the field (items shown, a page item chosen), and the field picker of a compact
 * header. The fields are stand-ins: the menu speaks only `IPivotTable.IField`, and what the field
 * does with a call is `pivot.controls`'s (io-xlsx).
 */
describe('PivotMenu', () => {
  beforeAll(() => {
    if (typeof window.matchMedia !== 'function') {
      (window as any).matchMedia = (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
      });
    }
  });

  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  const theme = createExhibitTheme(false);

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    document.body.innerHTML = '';
  });

  interface StubField extends IPivotTable.IField {
    setVisibleItems: ReturnType<typeof vi.fn>;
    setCurrentPage: ReturnType<typeof vi.fn>;
    applyFilter: ReturnType<typeof vi.fn>;
    clearFilter: ReturnType<typeof vi.fn>;
    clearAllFilters: ReturnType<typeof vi.fn>;
    sortByLabels: ReturnType<typeof vi.fn>;
    sortByValues: ReturnType<typeof vi.fn>;
  }

  interface StubOptions {
    filters?: IPivotTable.IField.Filters;
    sort?: IPivotTable.IField.Sort | null;
    dataFields?: string[];
    numberFormat?: string;
  }

  /** A field of `items` (name, shown), on `axis`, showing `page` when it is a page field with one chosen. */
  const fieldOf = (name: string, axis: IPivotTable.Axis, items: [string, boolean][], page: string | null = null, options: StubOptions = {}): StubField => {
    const { filters = {}, sort = null, dataFields = ['Sum of Sales'], numberFormat } = options;
    const field = {
      getName: () => name,
      getAxis: () => axis,
      getPivotTable: () => ({
        getFields: () => [field],
        toJSON: () => ({ fields: [{ numberFormat }], dataFields: dataFields.map((each) => ({ name: each, field: 1 })) })
      }),
      getFilters: () => filters,
      getSort: () => sort,
      applyFilter: vi.fn(async () => {}),
      clearFilter: vi.fn(async () => {}),
      clearAllFilters: vi.fn(async () => {}),
      sortByLabels: vi.fn(async () => {}),
      sortByValues: vi.fn(async () => {}),
      getItems: () => items.map(([itemName, visible]) => ({
        getName: () => itemName,
        isVisible: () => visible,
        isExpanded: () => true,
        getField: () => field
      })),
      getCurrentPage: () => page === null ? null : { getName: () => page },
      setVisibleItems: vi.fn(async () => {}),
      setCurrentPage: vi.fn(async () => {})
    };
    return field as unknown as StubField;
  };

  const settle = async (ms: number = 30): Promise<void> => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
  };

  const mount = async (fields: IPivotTable.IField[], floatReference: FloatReference): Promise<void> => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    // jsdom measures nothing: the list is told its box, so its rows render.
    const viewport = new Viewport();
    viewport.setSizes(260, 200, 260, 200);
    const workbook = new Workbook();
    await act(async () => {
      root!.render(createElement(ThemeProvider as never, { theme } as never,
        createElement(WorkbookProvider as never, { workbook } as never,
          createElement(PivotMenu as never, { fields, floatReference, propsChecklist: { viewport } } as never))));
    });
    await settle(50);
  };

  const boxes = (): HTMLInputElement[] => Array.from(host!.querySelectorAll('.filter-values .sxl-list-surface input[type="checkbox"]')) as HTMLInputElement[];
  const rows = (): string[] => boxes().map((box) => (box.parentElement!.parentElement!.textContent ?? '').trim());
  const checkedRows = (): string[] => boxes().filter((box) => box.checked).map((box) => (box.parentElement!.parentElement!.textContent ?? '').trim());
  const rowEl = (index: number): HTMLElement => boxes()[index].parentElement!.parentElement!;
  const button = (label: string): HTMLButtonElement =>
    Array.from(host!.querySelectorAll('button')).find((el) => el.textContent === label) as HTMLButtonElement;
  const click = async (el: Element): Promise<void> => {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    await settle(50);
  };
  const toggle = async (index: number): Promise<void> => {
    await act(async () => { rowEl(index).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    await settle();
  };
  const closeAllRef = (): FloatReference => ({ closeAll: vi.fn() } as unknown as FloatReference);

  it('lists the field\'s items checked as they show; Apply shows the items checked', async () => {
    const field = fieldOf('Product', IPivotTable.Axis.Row, [['A', true], ['B', false], ['C', true]]);
    const floatReference = closeAllRef();
    await mount([field], floatReference);
    expect(host!.textContent).toContain('Product');
    expect(rows()).toEqual(['A', 'B', 'C']);
    expect(checkedRows()).toEqual(['A', 'C']);
    await toggle(2); // C off
    await click(button('Apply'));
    expect(field.setVisibleItems).toHaveBeenCalledWith(['A']);
    expect(floatReference.closeAll).toHaveBeenCalled();
  });

  it('every item checked shows them all', async () => {
    const field = fieldOf('Product', IPivotTable.Axis.Row, [['A', true], ['B', false]]);
    await mount([field], closeAllRef());
    await toggle(1); // B on
    await click(button('Apply'));
    expect(field.setVisibleItems).toHaveBeenCalledWith(null);
  });

  it('nothing checked is not applied', async () => {
    const field = fieldOf('Product', IPivotTable.Axis.Row, [['A', true]]);
    await mount([field], closeAllRef());
    await toggle(0);
    expect(button('Apply').disabled).toBe(true);
  });

  it('a page field opens on its item; one item checked chooses it, more is a multiple selection, all is (All)', async () => {
    const field = fieldOf('Channel', IPivotTable.Axis.Page, [['Store', true], ['Web', true]], 'Web');
    await mount([field], closeAllRef());
    expect(checkedRows()).toEqual(['Web']);
    await click(button('Apply'));
    expect(field.setCurrentPage).toHaveBeenLastCalledWith('Web');
    await toggle(0); // Store on: both
    await click(button('Apply'));
    expect(field.setCurrentPage).toHaveBeenLastCalledWith(null);

    const multiple = fieldOf('Channel', IPivotTable.Axis.Page, [['Store', true], ['Web', true], ['Phone', false]]);
    await act(async () => { root?.unmount(); });
    host?.remove();
    await mount([multiple], closeAllRef());
    expect(checkedRows()).toEqual(['Store', 'Web']);
    await click(button('Apply'));
    expect(multiple.setVisibleItems).toHaveBeenLastCalledWith(['Store', 'Web']);
  });

  it('a compact header\'s button picks among its fields', async () => {
    const region = fieldOf('Region', IPivotTable.Axis.Row, [['East', true], ['West', true]]);
    const product = fieldOf('Product', IPivotTable.Axis.Row, [['A', true], ['B', true]]);
    await mount([region, product], closeAllRef());
    expect(rows()).toEqual(['East', 'West']);
    const select = host!.querySelector('.pivot-menu-field [role="combobox"]') as HTMLElement;
    expect(select.textContent).toBe('Region');
    await act(async () => { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    await settle(50);
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((el) => el.textContent === 'Product')!;
    await click(option);
    expect(rows()).toEqual(['A', 'B']);
    await toggle(0); // A off
    await click(button('Apply'));
    expect(product.setVisibleItems).toHaveBeenCalledWith(['B']);
    expect(region.setVisibleItems).not.toHaveBeenCalled();
  });

  const items: [string, boolean][] = [['A', true], ['B', true]];
  const modeButton = (value: string): HTMLElement => host!.querySelector(`.filter-mode button[value="${value}"]`) as HTMLElement;
  const activeMode = (): string | null => host!.querySelector('.filter-mode button[aria-pressed="true"]')?.getAttribute('value') ?? null;
  const editorSelect = (): HTMLElement => host!.querySelector('.filter-editor [role="combobox"]') as HTMLElement;
  const operand = (): HTMLInputElement =>
    Array.from(host!.querySelectorAll<HTMLInputElement>('.filter-editor input:not([type="checkbox"]):not([tabindex="-1"])'))
      .find((el) => el.getAttribute('aria-hidden') !== 'true') as HTMLInputElement;
  const mouseDown = async (el: Element): Promise<void> => {
    await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    await settle(50);
  };
  const pick = async (select: HTMLElement, title: string): Promise<void> => {
    await mouseDown(select);
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const option = options.find((el) => el.textContent === title) as HTMLElement;
    expect(option, `${title} (saw: ${options.map((el) => el.textContent).join(', ')})`).toBeTruthy();
    await click(option);
  };
  const type = async (text: string): Promise<void> => {
    const input = operand();
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      input.focus();
      set.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
  };

  it('sorts by the labels and by a data field\'s values, and closes', async () => {
    const field = fieldOf('Region', IPivotTable.Axis.Row, items);
    const floatReference = closeAllRef();
    await mount([field], floatReference);
    await click(host!.querySelector('.pivot-sort-labels-descending')!);
    expect(field.sortByLabels).toHaveBeenCalledWith('descending');
    expect(floatReference.closeAll).toHaveBeenCalledTimes(1);
    expect(host!.querySelector('.pivot-sort-values-descending')!.textContent).toBe('Sum of Sales: Largest to Smallest');
    await click(host!.querySelector('.pivot-sort-values-descending')!);
    expect(field.sortByValues).toHaveBeenCalledWith('descending', 'Sum of Sales');
  });

  it('marks the sort in force', async () => {
    const field = fieldOf('Region', IPivotTable.Axis.Row, items, null, { sort: { order: 'descending', dataField: 'Sum of Sales' } });
    await mount([field], closeAllRef());
    const mark = (name: string): string => host!.querySelector(`.pivot-sort-${name} .MuiListItemIcon-root`)!.innerHTML;
    expect(mark('values-descending')).not.toBe(mark('labels-descending'));
    expect(mark('values-ascending')).toBe(mark('labels-descending'));
  });

  it('a label rule reads the caption: Apply sets it and leaves the items shown', async () => {
    const field = fieldOf('Region', IPivotTable.Axis.Row, items);
    await mount([field], closeAllRef());
    expect(activeMode()).toBe('values');
    await click(modeButton('rule'));
    await pick(editorSelect(), 'Starts With');
    await type('N');
    await click(button('Apply'));
    expect(field.applyFilter).toHaveBeenCalledTimes(1);
    expect((field.applyFilter.mock.calls[0] as any[])[0].label).toMatchObject({ operator: 'textStartsWith', param: 'N' });
    expect(field.setVisibleItems).not.toHaveBeenCalled();
  });

  it('a rule without its operand is not applied', async () => {
    const field = fieldOf('Region', IPivotTable.Axis.Row, items);
    const floatReference = closeAllRef();
    await mount([field], floatReference);
    await click(modeButton('rule'));
    await click(button('Apply'));
    expect(field.applyFilter).not.toHaveBeenCalled();
    expect(floatReference.closeAll).not.toHaveBeenCalled();
  });

  it('a value rule names its data field, the one chosen when there are more', async () => {
    const field = fieldOf('Region', IPivotTable.Axis.Row, items, null, { dataFields: ['Sum of Sales', 'Sum of Qty'] });
    await mount([field], closeAllRef());
    await click(modeButton('value'));
    await pick(host!.querySelector('.pivot-menu-data-field [role="combobox"]') as HTMLElement, 'Sum of Qty');
    await pick(editorSelect(), 'Greater Than');
    await type('100');
    await click(button('Apply'));
    const input = (field.applyFilter.mock.calls[0] as any[])[0];
    expect(input.value.dataField).toBe('Sum of Qty');
    expect(input.value.condition).toMatchObject({ operator: 'greaterThan', param: 100 });
  });

  it('opens on a filter in force, and clears it alone or with the rest', async () => {
    const filters: IPivotTable.IField.Filters = { label: { selector: 'display', operator: 'textContains', param: 'o' } };
    const field = fieldOf('Region', IPivotTable.Axis.Row, items, null, { filters });
    await mount([field], closeAllRef());
    expect(activeMode()).toBe('rule');
    expect(operand().value).toBe('o');
    await click(host!.querySelector('.pivot-clear-rule')!);
    expect(field.clearFilter).toHaveBeenCalledWith('label');
    await click(host!.querySelector('.pivot-clear-filters')!);
    expect(field.clearAllFilters).toHaveBeenCalled();
  });

  it('a rule left as it was is not written again', async () => {
    const filters: IPivotTable.IField.Filters = { value: { condition: { operator: 'greaterThan', param: 2 }, dataField: 'Sum of Sales' } };
    const field = fieldOf('Region', IPivotTable.Axis.Row, items, null, { filters });
    const floatReference = closeAllRef();
    await mount([field], floatReference);
    expect(activeMode()).toBe('value');
    await click(button('Apply'));
    expect(field.applyFilter).not.toHaveBeenCalled();
    expect(floatReference.closeAll).toHaveBeenCalled();
  });

  it('a field of dates offers Date, not Label', async () => {
    const field = fieldOf('Day', IPivotTable.Axis.Row, items, null, { numberFormat: 'yyyy-mm-dd' });
    await mount([field], closeAllRef());
    expect(modeButton('rule').textContent).toBe('Date');
  });

  it('a page field has the checklist alone', async () => {
    const field = fieldOf('Channel', IPivotTable.Axis.Page, [['Store', true], ['Web', true]]);
    await mount([field], closeAllRef());
    expect(host!.querySelector('.filter-mode')).toBeNull();
    expect(host!.querySelector('.pivot-sort-labels-ascending')).toBeNull();
    expect(rows()).toEqual(['Store', 'Web']);
  });
});
