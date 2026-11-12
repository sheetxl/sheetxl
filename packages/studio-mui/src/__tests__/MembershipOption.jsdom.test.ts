import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Condition, Workbook, type ICondition, type IDataValidation, type IFilter, type IWorkbook } from '@sheetxl/sdk';

import { Viewport } from '@sheetxl/utils-react';
import { WorkbookProvider, useModelSync } from '@sheetxl/react';

import { toItemsDescriptor } from '../anchorItems';
import { ConditionEditor } from '../conditions';
import { MembershipOption } from '../conditions/MembershipOption';
import { FormulaFrameContext } from '../conditions/useFormulaOption';
import { DataValidationItemsDescriptor } from '../dataValidation/DataValidationDetailsPanel';
import { DataValidationEditorPanel } from '../dataValidation/DataValidationEditorPanel';

/**
 * The editor of a set: a source, a search line that also adds, and the
 * members as a list of real values. One component, with what its host can do: a validation builds
 * the set, a filter takes members out of a population.
 */
describe('MembershipOption', () => {

  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const settle = async (ms: number = 30): Promise<void> => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
  };

  /** jsdom measures nothing, so a list is told its box. */
  const sizedViewport = (): Viewport => {
    const viewport = new Viewport();
    viewport.setSizes(200, 200, 200, 200);
    return viewport;
  };

  const setInput = async (el: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
  };

  /** What a mounted editor offers, read from the DOM. */
  const controls = (container: HTMLElement) => {
    const boxes = (): HTMLInputElement[] =>
      Array.from(container.querySelectorAll('.sxl-list-surface input[type="checkbox"]')) as HTMLInputElement[];
    const rowOf = (box: HTMLInputElement): HTMLElement => box.parentElement!.parentElement!;
    const label = (box: HTMLInputElement): string => (rowOf(box).textContent ?? '').trim();
    const search = (): HTMLInputElement => container.querySelector('input[role="searchbox"]') as HTMLInputElement;
    return {
      source: (): HTMLInputElement | undefined => Array.from(container.querySelectorAll('input'))
        .find((el) => el.getAttribute('placeholder') === 'Values') as HTMLInputElement | undefined,
      /** The authored set's preview: what the active cell would be offered. */
      preview: (): string[] => Array.from(container.querySelectorAll('.list-preview [role="option"]'))
        .map((el) => (el.textContent ?? '').trim()),
      /** The preview's header row: its count. */
      previewCount: (): string => (container.querySelector('.list-preview-count')?.textContent ?? '').trim(),
      search,
      rows: (): string[] => boxes().map(label),
      checkedRows: (): string[] => boxes().filter((box) => box.checked).map(label),
      toggle: async (text: string): Promise<void> => {
        const box = boxes().find((el) => label(el) === text)!;
        await act(async () => { rowOf(box).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
        await settle();
      },
      selectAll: (): HTMLElement => container.querySelector('.sxl-select-all') as HTMLElement,
      addButton: (): HTMLButtonElement | null => container.querySelector('.sxl-add-value'),
      add: async (text: string): Promise<void> => {
        await setInput(search(), text);
        const button = container.querySelector('.sxl-add-value') as HTMLButtonElement;
        await act(async () => { button.click(); });
        await settle();
      },
      /** The By value toggle, from the menu under the search glyph, opened for it; null when not offered. */
      byValue: async (): Promise<HTMLInputElement | null> => {
        const options = container.querySelector('.sxl-search-options') as HTMLButtonElement | null;
        if (options && !container.querySelector('.sxl-by-value')) await act(async () => { options.click(); });
        return container.querySelector('.sxl-by-value input');
      },
      /** The error line under the source field. */
      error: (): string => (container.querySelector('.MuiFormHelperText-root.Mui-error')?.textContent ?? '').trim()
    };
  };

  describe('a validation builds the set', () => {
    const descriptor = toItemsDescriptor(DataValidationItemsDescriptor);

    const newWorkbook = async (locale?: string): Promise<IWorkbook> => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      if (locale) workbook.setLocale(locale);
      const sheet = workbook.getWorksheetAt(0)!;
      sheet.getRange('A1:A3').setValues([['Red'], ['Green'], ['Blue']]);
      sheet.getRange('C5:C7').select();
      return workbook;
    };

    /** A list draft over the selection, holding `param`. */
    const listDraft = (workbook: IWorkbook, param: ICondition.InSetOption = {}): IDataValidation => {
      const draft = descriptor.createDraft!(workbook);
      draft.setCondition({ operator: 'inSet', param } as never);
      return draft;
    };

    /** The validation pane's wiring of the condition editor, with a list that has a size. */
    const Host = ({ dataValidation, viewport }: { dataValidation: IDataValidation, viewport: Viewport }) => {
      useModelSync(dataValidation as never, 'onAnyChange');
      return createElement(FormulaFrameContext.Provider, { value: dataValidation },
        createElement(ConditionEditor as never, {
          condition: dataValidation.getCondition(),
          ranges: dataValidation.getRanges(),
          propsChecklist: { viewport },
          onConditionChange: (next: unknown) => { dataValidation.setCondition(next as never); }
        }));
    };

    const mount = async (workbook: IWorkbook, dataValidation: IDataValidation) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const viewport = sizedViewport();
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never,
          createElement(Host, { dataValidation, viewport })));
      });
      await settle();
      return { ...controls(container), unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); } };
    };

    /** The set as stored. */
    const setOf = (draft: IDataValidation): unknown => draft.getCondition()?.toJSON().param;

    it('types the list, split on the locale\'s separator, as additions', async () => {
      for (const [locale, typed, expected] of [['en', 'Yes, No', ['Yes', 'No']], ['de', 'Ja; Nein', ['Ja', 'Nein']]] as const) {
        const workbook = await newWorkbook(locale);
        const draft = listDraft(workbook);
        const panel = await mount(workbook, draft);
        expect(panel.preview(), locale).toEqual([]);
        await setInput(panel.source()!, typed);
        expect(setOf(draft), locale).toEqual({ additions: expected });
        await vi.waitFor(() => expect(panel.preview(), locale).toEqual(expected), { timeout: 3000 });
        await panel.unmount();
      }
    });

    it('shows a stored list as it would be typed, items and additions alike', async () => {
      const workbook = await newWorkbook();
      const panel = await mount(workbook, listDraft(workbook, { items: ['High', 'Low'], additions: ['Other'] }));
      expect(panel.source()!.value).toBe('High, Low, Other');
      await vi.waitFor(() => expect(panel.preview()).toEqual(['High', 'Low', 'Other']), { timeout: 3000 });
      await panel.unmount();
    });

    it('refuses a typed value a file cannot hold', async () => {
      const workbook = await newWorkbook('de');
      const draft = listDraft(workbook, { additions: ['a'] });
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, 'a,b; c');
      expect(setOf(draft)).toEqual({ additions: ['a'] });
      // The workbook locale sets the separator; the UI language stays English.
      expect(panel.error()).toBe('A list item cannot contain a comma');
      await setInput(panel.source()!, 'ab; c');
      expect(setOf(draft)).toEqual({ additions: ['ab', 'c'] });
      expect(panel.error()).toBe('');
      await panel.unmount();
    });

    it('the = decides: =range is a source, the same text bare is a typed value', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook);
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, '=$A$1:$A$3');
      expect(setOf(draft)).toEqual({ source: '$A$1:$A$3' });
      await vi.waitFor(() => expect(panel.preview()).toEqual(['Red', 'Green', 'Blue']), { timeout: 3000 });
      await setInput(panel.source()!, '$A$1:$A$3');
      expect(setOf(draft)).toEqual({ additions: ['$A$1:$A$3'] });
      await vi.waitFor(() => expect(panel.preview()).toEqual(['$A$1:$A$3']), { timeout: 3000 });
      await panel.unmount();
    });

    it('a source and a typed list are exclusive, and exclusions go with the source', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook, { source: '$A$1:$A$3', subtractions: ['Green'] });
      const panel = await mount(workbook, draft);
      expect(panel.source()!.value).toBe('=$A$1:$A$3');
      // An exclusion a stored set holds shows by its absence.
      await vi.waitFor(() => expect(panel.preview()).toEqual(['Red', 'Blue']), { timeout: 3000 });
      await setInput(panel.source()!, 'Other');
      expect(setOf(draft)).toEqual({ additions: ['Other'] });
      await setInput(panel.source()!, '=$A$1:$A$2');
      expect(setOf(draft)).toEqual({ source: '$A$1:$A$2' });
      await vi.waitFor(() => expect(panel.preview()).toEqual(['Red', 'Green']), { timeout: 3000 });
      await panel.unmount();
    });

    it('clears the set when the field is emptied', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook, { source: '$A$1:$A$3', subtractions: ['Green'] });
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, '');
      expect(setOf(draft)).toEqual({});
      await vi.waitFor(() => expect(panel.preview()).toEqual([]), { timeout: 3000 });
      await panel.unmount();
    });

    it('refuses a source of more than one range, bare or in parentheses', async () => {
      for (const typed of ['=($A$1:$A$2,$A$3)', '=$A$1:$A$2,$A$3']) {
        const workbook = await newWorkbook();
        const draft = listDraft(workbook, { additions: ['a'] });
        const panel = await mount(workbook, draft);
        await setInput(panel.source()!, typed);
        expect(setOf(draft), typed).toEqual({ additions: ['a'] });
        expect(panel.error(), typed).toBe('The source must be a single range');
        await panel.unmount();
      }
    });

    it('keeps a formula with several references that is not a union', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook);
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, '=OFFSET($A$1,0,0,$B$1+3)');
      expect(setOf(draft)).toEqual({ source: 'OFFSET($A$1,0,0,$B$1+3)' });
      expect(panel.error()).toBe('');
      await panel.unmount();
    });

    it('reads a relative source at the active cell and stores it at the anchor', async () => {
      const workbook = await newWorkbook();
      const sheet = workbook.getWorksheetAt(0)!;
      sheet.getRange('E7:G7').setValues([['x', 'y', 'z']]);
      const draft = listDraft(workbook);
      draft.setRanges('C5:C7');
      sheet.getRange('C7').select();
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, '=$E7:$G7');
      expect(setOf(draft)).toEqual({ source: '$E5:$G5' });
      await vi.waitFor(() => expect(panel.preview()).toEqual(['x', 'y', 'z']), { timeout: 3000 });
      await panel.unmount();
    });

    it('lists the blank a source holds, last, as the cell\'s dropdown does', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook, { source: '$A$1:$A$4' });
      const panel = await mount(workbook, draft);
      await vi.waitFor(() => expect(panel.preview()).toEqual(['Red', 'Green', 'Blue', '(Blank)']), { timeout: 3000 });
      await panel.unmount();
    });

    it('narrows the preview with its search, the count as the list\'s header, the set untouched', async () => {
      const workbook = await newWorkbook();
      const sheet = workbook.getWorksheetAt(0)!;
      sheet.getRange('B1:B10').setValues([['ax'], ['bx'], ['cx'], ['dx'], ['ex'], ['fx'], ['gx'], ['hx'], ['ix'], ['jy']]);
      const draft = listDraft(workbook, { source: '$B$1:$B$10' });
      const panel = await mount(workbook, draft);
      await vi.waitFor(() => expect(panel.preview().length).toBe(10), { timeout: 3000 });
      expect(panel.previewCount()).toBe('10 items');
      await setInput(panel.search(), 'y');
      await vi.waitFor(() => expect(panel.preview()).toEqual(['jy']), { timeout: 3000 });
      expect(panel.previewCount()).toBe('1 / 10 (filtered)');
      expect(setOf(draft)).toEqual({ source: '$B$1:$B$10' });
      await panel.unmount();
    });

    it('takes the selection as a source, with its =, bare on the rule\'s sheet', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook);
      const panel = await mount(workbook, draft);
      workbook.getWorksheetAt(0)!.getRange('A1:A3').select();
      // The field's own button: the rule's range field has one too.
      const button = panel.source()!.closest('.MuiFormControl-root')!
        .querySelector('[aria-label="select-current-range"]') as HTMLElement;
      await act(async () => { button.click(); });
      expect(panel.source()!.value).toBe('=$A$1:$A$3');
      expect(setOf(draft)).toEqual({ source: '$A$1:$A$3' });
      await panel.unmount();
    });

    it('keeps a lone = with no error while the source is expected', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook, { additions: ['1', '2', '3'] });
      const panel = await mount(workbook, draft);
      await setInput(panel.source()!, '=');
      expect(panel.source()!.value).toBe('=');
      expect(panel.error()).toBe('');
      expect(setOf(draft)).toEqual({ additions: ['1', '2', '3'] });
      await setInput(panel.source()!, '=$A$1:$A$3');
      expect(setOf(draft)).toEqual({ source: '$A$1:$A$3' });
      await panel.unmount();
    });

    it('offers no "By value": a typed value is text and a source is matched as it is', async () => {
      const workbook = await newWorkbook();
      const panel = await mount(workbook, listDraft(workbook, { source: '$A$1:$A$3' }));
      expect(await panel.byValue()).toBeNull();
      await panel.unmount();
    });

    it('asks Ignore Blank once, and lists no (Blank) row for a typed list without one', async () => {
      const workbook = await newWorkbook();
      const draft = listDraft(workbook, { additions: ['a'] });
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root: Root = createRoot(container);
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never,
          createElement(DataValidationEditorPanel, { dataValidation: draft })));
      });
      await settle();
      const labels = Array.from(container.querySelectorAll('.include-blanks'));
      expect(labels.map((el) => el.textContent?.trim())).toEqual(['Ignore Blank']);
      await act(async () => { root.unmount(); });

      const panel = await mount(workbook, draft);
      await vi.waitFor(() => expect(panel.preview()).toEqual(['a']), { timeout: 3000 });
      await panel.unmount();
    });
  });

  describe('a filter takes members out of a population', () => {
    const population: IFilter.Items = {
      items: [
        { text: 'a', value: 'a', count: 2, checked: true },
        { text: 'b', value: 'b', count: 1, checked: true },
        { text: 'c', value: 'c', count: 1, checked: false }
      ],
      hasBlanks: true,
      blanksChecked: true,
      truncated: false
    } as unknown as IFilter.Items;

    const mount = async (overrides: Partial<IFilter.Items> = {}) => {
      const said: ICondition.InSetOption[] = [];
      const whole: boolean[] = [];
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const getItems = async (): Promise<IFilter.Items> => ({ ...population, ...overrides });
      await act(async () => {
        root.render(createElement(MembershipOption, {
          option: {},
          selector: Condition.Selectors.get('display'),
          onSelectorChange: () => {},
          onOptionChange: (option: ICondition.InSetOption) => { said.push(option); },
          getItems,
          propsChecklist: { viewport: sizedViewport(), onWholeChange: (value: boolean) => { whole.push(value); } }
        }));
      });
      await settle(60);
      return {
        ...controls(container), said, whole,
        last: (): ICondition.InSetOption => said[said.length - 1],
        unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
      };
    };

    it('has no source and nothing to add: its members are the population\'s', async () => {
      const editor = await mount();
      expect(editor.source()).toBeUndefined();
      await setInput(editor.search(), 'zzz');
      expect(editor.addButton()).toBeNull();
      expect(await editor.byValue()).not.toBeNull();
      await editor.unmount();
    });

    it('lists the blank last, checked as its rows pass, and says it back as the set\'s blank', async () => {
      const editor = await mount();
      expect(editor.rows()).toEqual(['a', 'b', 'c', '(Blank)']);
      expect(editor.checkedRows()).toEqual(['a', 'b', '(Blank)']);
      // Said back on load as shown: the blank is a member.
      expect(editor.last()).toEqual({ items: ['a', 'b'], blank: true });
      await editor.toggle('(Blank)');
      expect(editor.last()).toEqual({ items: ['a', 'b'] });
      await editor.unmount();

      const none = await mount({ hasBlanks: false, blanksChecked: false });
      expect(none.rows()).toEqual(['a', 'b', 'c']);
      expect(none.last()).toEqual({ items: ['a', 'b'] });
      await none.unmount();
    });

    it('takes a member out with its checkbox, and Select All acts on the rows in view', async () => {
      const editor = await mount();
      await editor.toggle('b');
      expect(editor.last()).toEqual({ items: ['a'], blank: true });

      await setInput(editor.search(), 'c');
      await act(async () => { editor.selectAll().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
      await settle();
      // `c` was in view and is checked; `b`, narrowed away, kept its state.
      expect(editor.last()).toEqual({ items: ['a', 'c'], blank: true });
      await editor.unmount();
    });

    it('tells its host when every value of the population is checked', async () => {
      const editor = await mount();
      expect(editor.whole[editor.whole.length - 1]).toBe(false);
      await editor.toggle('c');
      expect(editor.whole[editor.whole.length - 1]).toBe(true);
      await editor.unmount();

      // A list cut short at the host's cap is never the whole population.
      const cut = await mount({
        items: population.items.map((item) => ({ ...item, checked: true })), truncated: true
      } as Partial<IFilter.Items>);
      expect(cut.whole[cut.whole.length - 1]).toBe(false);
      await cut.unmount();
    });
  });

});
