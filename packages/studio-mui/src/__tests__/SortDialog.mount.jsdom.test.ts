import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, Sort, IRange, type ISort, type ICellRange } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { SortDialog } from '../dialog/SortDialog';

/**
 * Mount/interaction tests for the multi-level sort dialog: the level list is the model the dialog
 * edits, and each of these covers a way the emitted `ISort.RangeOptions` has to line up with what
 * is on screen.
 */
describe('SortDialog (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /** A three-field sheet with a text header row over numbers, so the header sniff fires. */
  const seed = async (): Promise<{ workbook: Workbook; range: ICellRange }> => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:C1').setValues([['Name', 'Region', 'Total']]);
    sheet.getRange('A2:C4').setValues([
      ['ada', 'east', 3],
      ['bob', 'west', 1],
      ['cyd', 'east', 2]
    ]);
    return { workbook, range: sheet.getRange('A1:C4') };
  };

  const open = async (
    workbook: Workbook, range: ICellRange, initialValue: ISort.RangeOptions
  ): Promise<{ emitted: (ISort.RangeOptions | undefined)[] }> => {
    const emitted: (ISort.RangeOptions | undefined)[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(SortDialog as never, {
          open: true,
          initialValue,
          context: () => ({ range, cell: range.getCell() }),
          onInput: (value: ISort.RangeOptions | undefined) => { emitted.push(value); }
        } as never)));
    });
    return { emitted };
  };

  const click = async (element: Element | null): Promise<void> => {
    expect(element).toBeTruthy();
    await act(async () => { (element as HTMLElement).click(); });
  };

  /** Drive a MUI Select the way the browser does — it opens on MOUSEDOWN, not click. */
  const pick = async (selectRoot: Element | null, value: string): Promise<void> => {
    expect(selectRoot).toBeTruthy();
    const combobox = (selectRoot as HTMLElement).querySelector('[role="combobox"]') as HTMLElement;
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const option = document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement;
    expect(option).toBeTruthy();
    await act(async () => { option.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  /** The dialog's own action button, by its identity class from `OptionsDialog`. */
  const sortButton = (): HTMLButtonElement => {
    const buttons = Array.from(document.querySelectorAll('button.defaultOption'));
    return buttons[buttons.length - 1] as HTMLButtonElement;
  };

  const submit = async (): Promise<void> => {
    await click(sortButton());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  /** The refusal line the dialog shows when it will not sort. */
  const refusalText = (): string | null =>
    document.querySelector('.sxl-sort-refusal')?.textContent?.trim() ?? null;

  const levelCards = (): Element[] => Array.from(document.querySelectorAll('.sxl-sort-field'));

  it('renders one card per level and emits them in priority order', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 1, criteria: { reverse: false } }, { index: 2, criteria: { reverse: true } }]
    });

    expect(levelCards()).toHaveLength(2);

    await submit();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.sorts?.map((sort) => sort.index)).toEqual([1, 2]);
    expect(emitted[0]?.sorts?.map((sort) => sort.criteria?.reverse)).toEqual([false, true]);
  }, 30_000);

  it('seeds a single default level when none was supplied', async () => {
    const { workbook, range } = await seed();
    await open(workbook, range, { hasHeader: true });
    expect(levelCards()).toHaveLength(1);
    // Nothing to delete down to — the last level's delete is refused.
    expect((document.querySelector('.sxl-sort-deleteLevel') as HTMLButtonElement).disabled).toBe(true);
  }, 30_000);

  it('adds a level on a field not already spoken for', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 0, criteria: {} }]
    });

    // The add row carries the priority label of the level it would create, so it reads as the next
    // one rather than as a loose button.
    const addRow = document.querySelector('.sxl-sort-addLevel')!.closest('div[class]')!.parentElement!;
    expect(addRow.textContent).toContain('Then by');

    await click(document.querySelector('.sxl-sort-addLevel'));
    expect(levelCards()).toHaveLength(2);

    await submit();
    // Field 0 was taken, so the new level lands on 1 rather than duplicating.
    expect(emitted[0]?.sorts?.map((sort) => sort.index)).toEqual([0, 1]);
  }, 30_000);

  it('duplicates and deletes a level', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 0, criteria: {} }, { index: 1, criteria: {} }]
    });

    await click(document.querySelectorAll('.sxl-sort-copyLevel')[1]);
    expect(levelCards()).toHaveLength(3);
    // The copy sits directly after its source and names the same field, so the action goes dead.
    expect(sortButton().disabled).toBe(true);
    expect(refusalText()).toContain('Region');
    await submit();
    expect(emitted).toHaveLength(0);

    await click(document.querySelectorAll('.sxl-sort-deleteLevel')[2]);
    expect(levelCards()).toHaveLength(2);
    await submit();
    expect(emitted[0]?.sorts?.map((sort) => sort.index)).toEqual([0, 1]);
  }, 30_000);

  it('offers no reordering for a lone level', async () => {
    const { workbook, range } = await seed();
    await open(workbook, range, { hasHeader: true, sorts: [{ index: 0, criteria: {} }] });

    expect(document.querySelector('.sxl-sort-moveUp')).toBeNull();
    expect(document.querySelector('.sxl-sort-moveDown')).toBeNull();
    expect(document.querySelector('.sxl-sortable-card')!.classList.contains('sxl-drag-disabled')).toBe(true);

    // Both come back with a second level.
    await click(document.querySelector('.sxl-sort-addLevel'));
    expect(document.querySelectorAll('.sxl-sort-moveUp')).toHaveLength(2);
    expect(document.querySelector('.sxl-sortable-card.sxl-drag-disabled')).toBeNull();
  }, 30_000);

  it('reorders priority with the move buttons', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 0, criteria: {} }, { index: 2, criteria: {} }]
    });

    // The first card can not move up, the last can not move down.
    expect((document.querySelectorAll('.sxl-sort-moveUp')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((document.querySelectorAll('.sxl-sort-moveDown')[1] as HTMLButtonElement).disabled).toBe(true);

    await click(document.querySelectorAll('.sxl-sort-moveUp')[1]);
    await submit();
    expect(emitted[0]?.sorts?.map((sort) => sort.index)).toEqual([2, 0]);
  }, 30_000);

  it('toggles a level between ascending and descending', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 0, criteria: { reverse: false } }, { index: 1, criteria: { reverse: false } }]
    });

    await click(document.querySelectorAll('.sxl-sort-order')[1]);
    await submit();
    expect(emitted[0]?.sorts?.map((sort) => sort.criteria?.reverse)).toEqual([false, true]);
    // The range-wide default tracks the PRIMARY level, not the one just toggled.
    expect(emitted[0]?.reverse).toBe(false);
  }, 30_000);

  it('keeps the case-sensitivity choice across an orientation flip', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      collatorOptions: Sort.CaseSensitiveOptions,
      sorts: [{ index: 0, criteria: {} }]
    });

    await pick(document.querySelector('.sxl-sort-orientation'), String(IRange.Axis.Column));
    await submit();

    expect(emitted[0]?.axis).toBe(IRange.Axis.Column);
    expect((emitted[0]?.collatorOptions as Intl.CollatorOptions)?.sensitivity)
      .toBe(Sort.CaseSensitiveOptions.sensitivity);
  }, 30_000);

  it('drops per-level collator options so the sort-wide toggle governs', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, {
      hasHeader: true,
      collatorOptions: Sort.CaseInsensitiveOptions,
      // What a table's stored criteria looks like — it would otherwise outrank the checkbox.
      sorts: [{ index: 0, criteria: { collatorOptions: Sort.CaseSensitiveOptions } }]
    });

    await submit();
    expect(emitted[0]?.sorts?.[0].criteria?.collatorOptions).toBeUndefined();
    expect((emitted[0]?.collatorOptions as Intl.CollatorOptions)?.sensitivity)
      .toBe(Sort.CaseInsensitiveOptions.sensitivity);
  }, 30_000);

  it('reserves the action row width at rest so cards do not resize on hover', async () => {
    const { workbook, range } = await seed();
    // Two levels, so the full action set (move up/down included) is mounted.
    await open(workbook, range, { hasHeader: true, sorts: [{ index: 0, criteria: {} }, { index: 1, criteria: {} }] });

    const actions = document.querySelector('.sxl-sort-level-actions') as HTMLElement;
    expect(actions).toBeTruthy();
    const resting = getComputedStyle(actions);
    // Faded and inert, but still occupying its column.
    expect(resting.opacity).toBe('0');
    expect(resting.pointerEvents).toBe('none');
    expect(resting.width).not.toBe('0px');
    // All four affordances are mounted at rest — nothing appears or disappears on hover.
    expect(actions.querySelectorAll('button')).toHaveLength(4);
  }, 30_000);

  it('re-enables the action once the duplicate is resolved', async () => {
    const { workbook, range } = await seed();
    await open(workbook, range, {
      hasHeader: true,
      sorts: [{ index: 0, criteria: {} }, { index: 0, criteria: {} }]
    });

    expect(sortButton().disabled).toBe(true);
    await pick(document.querySelectorAll('.sxl-sort-field')[1], '2');
    expect(refusalText()).toBeNull();
    expect(sortButton().disabled).toBe(false);
  }, 30_000);

  it('refuses more levels than the shape has fields, and says so in those terms', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sheet = workbook.getSelectedWorksheet();
    // One column: a second level has nowhere to go, whichever field it names.
    sheet.getRange('A1:A4').setValues([['ada'], ['bob'], ['cyd'], ['dee']]);
    const range = sheet.getRange('A1:A4');

    await open(workbook, range, { sorts: [{ index: 0, criteria: {} }, { index: 0, criteria: {} }] });

    expect(sortButton().disabled).toBe(true);
    // Not "Column A twice" — the selection is what has no room.
    expect(refusalText()).toContain('more sort levels');
    expect(refusalText()).not.toContain('more than once');

    // Deleting back down to what fits clears it.
    await click(document.querySelectorAll('.sxl-sort-deleteLevel')[1]);
    expect(refusalText()).toBeNull();
    expect(sortButton().disabled).toBe(false);
  }, 30_000);

  /** The field menu's option values, read by opening the first level's field Select then closing it. */
  const listedFields = async (): Promise<number[]> => {
    const combobox = document.querySelector('.sxl-sort-field [role="combobox"]') as HTMLElement;
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const values = options.map((option) => Number((option as HTMLElement).dataset.value));
    const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0];
    await act(async () => { (selected as HTMLElement).click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    return values;
  };

  it('lists only fields with data, and hidden ones only when asked', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sheet = workbook.getSelectedWorksheet();
    // B is hidden, D is blank (a heading with nothing under it still counts — E does not exist at all).
    sheet.getRange('A1:E1').setValues([['Name', 'Secret', 'Region', null, 'Total']]);
    sheet.getRange('A2:C3').setValues([['ada', 'x', 'east'], ['bob', 'y', 'west']]);
    sheet.getRange('E2:E3').setValues([[3], [1]]);
    sheet.getRange('B:B').getColumnHeaders().setHidden(true);
    // Whole-sheet selection with the anchor off the data, as Ctrl-A leaves it.
    await open(workbook, sheet.getEntireRange(), { hasHeader: true, includeHidden: false });

    expect(await listedFields()).toEqual([0, 2, 4]);

    const includeHidden = Array.from(document.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Include Hidden'))!.querySelector('input') as HTMLInputElement;
    await click(includeHidden);
    expect(await listedFields()).toEqual([0, 1, 2, 4]);
  }, 30_000);

  it('emits nothing when cancelled', async () => {
    const { workbook, range } = await seed();
    const { emitted } = await open(workbook, range, { hasHeader: true, sorts: [{ index: 0, criteria: {} }] });

    const cancel = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Cancel');
    await click(cancel ?? null);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });

    expect(emitted).toEqual([undefined]);
  }, 30_000);
});
