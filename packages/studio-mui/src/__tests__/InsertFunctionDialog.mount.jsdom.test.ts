import { describe, it, expect, vi, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IFunction, type IFunctionCollection, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { InsertFunctionDialog } from '../dialog/InsertFunctionDialog';

/**
 * Mount/interaction tests for the Insert Function dialog. The catalog is injected as the command's
 * `FormulaFunction` context, so these run against a stub rather than the real (async, descriptor-
 * loading) SDK search — what is under test is the dialog's wiring: browse, search, select, insert.
 */
describe('InsertFunctionDialog (mount)', () => {
  /** A `number`-shaped parameter: the period-1 repeating group `SUM` is really declared with. */
  const restParam = (name: string) => ({
    getName: () => name,
    isOptional: () => false,
    isRest: () => false,
    getScalarType: () => 'number',
    getEnum: () => null,
    getRepeatingTypes: () => [{
      getName: () => name,
      isOptional: () => false,
      isRest: () => false,
      getScalarType: () => 'number',
      getEnum: () => null,
      getRepeatingTypes: () => null
    }]
  });

  /** The two rows the stub catalog serves, standing in for real `IFunction`s. */
  const createFunction = (name: string, summary: string, params: unknown[] = []): IFunction => ({
    getName: () => name,
    isLambda: () => false,
    getDeclaration: () => ({ getParameters: () => params }),
    getDescriptor: () => Promise.resolve({
      getName: () => name,
      getNameLocal: () => name,
      getSummary: () => summary,
      getCategory: () => 'Math & Trig',
      getParameters: () => ({}),
      // Every accessor the panel's `createFunctionDescriptor` reads: a missing one throws into its
      // `catch`, which is indistinguishable from a function that simply has no description.
      getEnums: () => ({})
    })
  } as unknown as IFunction);

  const SUM = createFunction('SUM', 'Adds all the numbers in a range of cells.', [restParam('number')]);
  const SUMIF = createFunction('SUMIF', 'Adds the cells specified by a given condition.');

  const createContext = (overrides?: Partial<Record<string, unknown>>) => {
    const categories: IFunctionCollection.Category[] = [{ name: 'Math & Trig', count: 2 }];
    return {
      searchByCategory: vi.fn(async () => [SUM, SUMIF]),
      searchByText: vi.fn(async (text: string) => (text.toUpperCase().startsWith('SUMI') ? [SUMIF] : [SUM, SUMIF])),
      getCategories: vi.fn(async () => categories),
      ...overrides
    };
  };

  /**
   * Mounted dialogs, torn down after every test. Tracked rather than left to each test's own
   * `unmount()` because the dialog PORTALS to the body: a test that fails before unmounting leaves a
   * live dialog in the document, and the next test's `document.querySelector` then finds the stale
   * one — turning one real failure into four.
   */
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement; workbook: IWorkbook }> = [];

  const teardown = async ({ root, container, workbook }: typeof mounted[number]): Promise<void> => {
    await act(async () => { root.unmount(); });
    container.remove();
    workbook.close();
  };

  afterEach(async () => {
    for (const entry of mounted.splice(0)) await teardown(entry);
  });

  /** The dialog's reference fields pick from the workbook in context, as the app mounts it. */
  const open = async (props: Record<string, unknown>, workbook: IWorkbook = new Workbook()) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const entry = { root, container, workbook };
    mounted.push(entry);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(InsertFunctionDialog as never, { open: true, ...props })));
    });
    return {
      unmount: async () => {
        const index = mounted.indexOf(entry);
        if (index >= 0) mounted.splice(index, 1);
        await teardown(entry);
      }
    };
  };

  /**
   * The dialog PORTALS to the body — every query goes through the document. Scoped to the function
   * list, which the open category dropdown would otherwise pollute (it is a `listbox` too).
   */
  const rows = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('.function-list [role="option"]'));
  /** Each row's NAME — the selected row also shows its summary under it. */
  const rowText = (): string[] => rows().map(row => row.querySelector('.sxl-named-item-name')?.textContent ?? '');

  /**
   * The page that is UP. A page turn hides rather than unmounts (the search's query, category and
   * scroll — and page 2's filled arguments — have to survive one), so both pages are in the document
   * once both have been visited, and only `hidden` tells them apart.
   */
  const page = (which: 'search' | 'arguments'): HTMLElement | null =>
    document.querySelector(`.insert-function-page[data-page="${which}"]:not([hidden])`);
  /** The visible page's `<input>`s, in row order. */
  const inputs = (which: 'search' | 'arguments'): HTMLInputElement[] =>
    Array.from(page(which)?.querySelectorAll('input') ?? []);

  /** An action button by its label (the default one is also `.defaultOption`). */
  const button = (label: string): HTMLButtonElement =>
    Array.from(document.querySelectorAll('button'))
      .find(item => item.textContent?.trim() === label) as HTMLButtonElement;

  /** Click a dialog button and let the form-submit path's ripple delay run out. */
  const activate = async (element: HTMLElement): Promise<void> => {
    await act(async () => { element.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
  };

  /** Type into an `<input>` the way the browser does (React listens to the native `input` event). */
  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('lists the category catalog and selects the first row', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    expect(rowText()).toEqual(['SUM', 'SUMIF']);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    // Browsing asks for every category (the "All" entry), not a named one.
    expect(context.searchByCategory).toHaveBeenCalledWith(undefined);
    expect(context.getCategories).toHaveBeenCalled();
    await unmount();
  });

  it('makes the results a tab stop that names its selected row, and arrows within it', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    const list = document.querySelector('.function-list') as HTMLElement;
    // ONE tab stop for the whole list (the listbox pattern) — not a stop per function, which for a
    // catalog this size is not navigation. The rows stay unfocusable; the selected one is NAMED.
    expect(list.getAttribute('tabindex')).toBe('0');
    expect(rows().some(row => row.hasAttribute('tabindex'))).toBe(false);
    expect(list.getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    expect(rows()[0].id).toBeTruthy();

    // Arrow keys travel the list once it holds the keyboard, and the pointer follows.
    await act(async () => { list.focus(); });
    const arrow = async (key: string, keyCode: number): Promise<void> => {
      await act(async () => {
        list.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true } as KeyboardEventInit));
      });
    };
    await arrow('ArrowDown', 40);
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    expect(list.getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    await arrow('Home', 36);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await arrow('End', 35);
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    await unmount();
  });

  it('leaves Home/End to the caret while the SEARCH box has the keyboard', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    // Arrows drive the list from the search box (dead keys in a single-line field). Home/End are
    // not: there they mean "caret to the start of my query".
    const search = document.querySelector('input.autoFocus') as HTMLInputElement;
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true } as KeyboardEventInit));
    });
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    const end = new KeyboardEvent('keydown', { key: 'End', keyCode: 35, bubbles: true, cancelable: true } as KeyboardEventInit);
    await act(async () => { search.dispatchEvent(end); });
    expect(end.defaultPrevented).toBe(false);
    await unmount();
  });

  it('shows the selected function\'s signature and summary', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    // The descriptor resolves a tick after mount (it is loaded lazily, like the editor's preview).
    await act(async () => { await Promise.resolve(); });
    const text = document.body.textContent ?? '';
    expect(text).toContain('SUM');
    expect(text).toContain('Adds all the numbers in a range of cells.');
    await unmount();
  });

  it('expands exactly the SELECTED row with its summary; hover does not select', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    await act(async () => { await Promise.resolve(); });
    expect(rows()[0].textContent).toContain('Adds all the numbers in a range of cells.');
    expect(rows()[1].textContent).not.toContain('Adds the cells specified');

    // Passing over a row on the way somewhere else changes nothing.
    await act(async () => {
      rows()[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      rows()[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    expect(rows()[1].textContent).not.toContain('Adds the cells specified');

    await act(async () => { rows()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    expect(rows()[1].textContent).toContain('Adds the cells specified by a given condition.');
    expect(rows()[0].textContent).not.toContain('Adds all the numbers');
    await unmount();
  });

  it('searches on typed text (debounced) and re-selects the top hit', async () => {
    vi.useFakeTimers();
    try {
      const context = createContext();
      const { unmount } = await open({ context: () => context, onInput: () => {} });

      const search = document.querySelector('input.autoFocus') as HTMLInputElement;
      expect(search).toBeTruthy();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(search, 'sumif');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // Nothing has searched yet — that is the debounce doing its job.
      expect(context.searchByText).not.toHaveBeenCalled();

      await act(async () => { await vi.runAllTimersAsync(); });
      // No category chosen ⇒ the search spans all of them.
      expect(context.searchByText).toHaveBeenCalledWith('sumif', { category: undefined, limit: expect.any(Number) });
      expect(rowText()).toEqual(['SUMIF']);
      expect(rows()[0].getAttribute('aria-selected')).toBe('true');
      await unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-selects the top row when the search is cleared', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    const search = document.querySelector('input.autoFocus') as HTMLInputElement;
    const type = async (text: string): Promise<void> => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(search, text);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    };

    await type('sumi');
    expect(rowText()).toEqual(['SUMIF']);

    // Clearing is a NEW query, not a return to the old state: the browse list comes back and the
    // hint follows it, rather than describing the function the abandoned search had landed on.
    await type('');
    expect(rowText()).toEqual(['SUM', 'SUMIF']);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    expect(rows()[1].getAttribute('aria-selected')).toBe('false');
    await unmount();
  });

  it('narrows a text search to the chosen category', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    // Pick a category from the dropdown (its menu is portaled and only exists once opened).
    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    expect(combobox).toBeTruthy();
    // MUI's Select opens on MOUSEDOWN, not click.
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const option = Array.from(document.querySelectorAll('[role="option"]'))
      .find(item => item.textContent === 'Math & Trig') as HTMLElement;
    expect(option).toBeTruthy();
    await act(async () => { option.click(); });
    expect(context.searchByCategory).toHaveBeenLastCalledWith('Math & Trig');

    // Typing must not throw the category away — it stays a filter over the search.
    const search = document.querySelector('input.autoFocus') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'sum');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    expect(context.searchByText).toHaveBeenCalledWith('sum', {
      category: 'Math & Trig', limit: expect.any(Number)
    });
    await unmount();
  });

  it('inserts the selected function from the search page and closes', async () => {
    const context = createContext();
    const onInput = vi.fn();
    const onDone = vi.fn();
    const { unmount } = await open({ context: () => context, onInput, onDone });

    // Move to the second row, then take the page's OTHER action — Insert, which hands the host the
    // function to seed (`=NAME(`) rather than going on to fill its arguments.
    await act(async () => { rows()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');

    await activate(button('Insert'));

    expect(onInput).toHaveBeenCalledWith(SUMIF);
    expect(onDone).toHaveBeenCalled();
    await unmount();
  });

  it('does not insert when the search found nothing', async () => {
    const context = createContext({ searchByCategory: vi.fn(async () => []) });
    const onInput = vi.fn();
    const { unmount } = await open({ context: () => context, onInput });

    expect(rows()).toHaveLength(0);
    await activate(document.querySelector('button.defaultOption') as HTMLButtonElement);

    expect(onInput).not.toHaveBeenCalled();
    await unmount();
  });

  // ── Page 2 — the argument wizard ───────────────────────────────────────────────────────────────

  it('advances to the argument page on the default action, and comes back', async () => {
    const context = createContext();
    const onDone = vi.fn();
    const { unmount } = await open({ context: () => context, onInput: () => {}, onDone });

    // The default is NEXT, not Insert: choosing a function is the first of two steps.
    const next = document.querySelector('button.defaultOption') as HTMLButtonElement;
    expect(next.textContent?.trim()).toBe('Next');
    await activate(next);

    // A page move is not an outcome — the dialog stays open, under the SAME title (one window, one
    // name; a retitle mid-flow reads as a second dialog).
    expect(onDone).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Insert Function');
    // SUM's repeating parameter opens on its first instance plus a spare.
    expect(document.body.textContent).toContain('number1');
    expect(document.body.textContent).toContain('number2');
    expect(page('arguments')).toBeTruthy();
    expect(page('search')).toBeNull();

    await activate(button('Back'));
    expect(onDone).not.toHaveBeenCalled();
    expect(page('search')).toBeTruthy();
    expect(page('arguments')).toBeNull();
    await unmount();
  });

  it('keeps each page\'s state across a page turn', async () => {
    const context = createContext();
    const { unmount } = await open({ context: () => context, onInput: () => {} });

    // A query, so page 1 has state worth losing. (`sum` keeps SUM on top — the row with arguments.)
    const search = document.querySelector('input.autoFocus') as HTMLInputElement;
    await type(search, 'sum');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    expect(rowText()).toEqual(['SUM', 'SUMIF']);

    await activate(document.querySelector('button.defaultOption') as HTMLButtonElement);
    // Page 1 is still THERE, just hidden — which is what keeps its query and its results.
    expect(page('search')).toBeNull();
    expect(document.querySelectorAll('.function-list').length).toBe(1);

    // Fill an argument, then leave and come back to it.
    await type(inputs('arguments')[0], 'A1:A5');
    await activate(button('Back'));

    // The search survived the round trip: no re-search, no reset to the browse list.
    expect((document.querySelector('input.autoFocus') as HTMLInputElement).value).toBe('sum');
    expect(rowText()).toEqual(['SUM', 'SUMIF']);

    // And so did the argument — the same function, so the same form.
    await activate(document.querySelector('button.defaultOption') as HTMLButtonElement);
    expect(inputs('arguments')[0].value).toBe('A1:A5');
    await unmount();
  });

  it('DOUBLE-CLICKING a row takes the default action (Next), not Insert', async () => {
    const context = createContext();
    const onInput = vi.fn();
    const onDone = vi.fn();
    const { unmount } = await open({ context: () => context, onInput, onDone });

    // The list's "that one". It must reach the same handler the default BUTTON reaches, with the
    // same argument — the option's identity. Forwarding the rich option (`{ id: 'Next', label }`)
    // instead made the handler's `option === Next` test answer false, and the double-click inserted.
    await act(async () => { rows()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });

    expect(onInput).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('number1');
    await unmount();
  });

  it('assembles the filled arguments into the call it inserts', async () => {
    const context = createContext();
    const onInput = vi.fn();
    const onDone = vi.fn();
    const { unmount } = await open({ context: () => context, onInput, onDone });

    await activate(document.querySelector('button.defaultOption') as HTMLButtonElement);

    // The argument fields, in row order. Scoped to the visible page: page 1 is hidden behind this
    // one, not unmounted, so its search box and category are still `input`s in the document.
    const fields = inputs('arguments');
    await type(fields[0], 'A1:A5');
    // Filling the last row grows the form — that is how a rest parameter is filled.
    expect(inputs('arguments').length).toBe(2);
    await type(fields[1], 'B1');
    expect(inputs('arguments').length).toBe(3);

    await activate(document.querySelector('button.defaultOption') as HTMLButtonElement);
    // TEXT, not the function: the arguments are already filled, so the host has a whole call to
    // insert. The empty third row trims away (it is an optional repetition).
    expect(onInput).toHaveBeenCalledWith('=SUM(A1:A5,B1)');
    expect(onDone).toHaveBeenCalled();
    await unmount();
  });

  it('opens on a workbook whose engine is still STARTING, and fills once it is ready', async () => {
    // The context the `insertFunctionDialog` command actually builds, over a live workbook — opened
    // deliberately without awaiting the calculation, which is the real race (the command is
    // reachable before the first calculation finishes). Reading the built-in registry too early
    // throws "Calculation is starting"; the context waits for the engine instead.
    const workbook = new Workbook();
    const functions = async () => {
      await workbook.getCalculation().start();
      return workbook.getCalculation().getFunctions();
    };
    const context = {
      searchByCategory: async (category?: string) => (await functions()).search({ category, type: 'formula' }),
      searchByText: async (text: string, limit?: number) => (await functions()).search({ text, type: 'formula', limit }),
      getCategories: async () => (await functions()).getCategories({ type: 'formula' })
    };
    const { unmount } = await open({ context: () => context, onInput: () => {} }, workbook);
    expect(document.querySelector('input.autoFocus')).toBeTruthy();

    // Let the engine finish inside the test (a start left in flight resolves after teardown), then
    // let the dialog's pending searches land.
    await act(async () => { await workbook.getCalculation().ready(); });
    // Then the descriptor index itself (one dynamic import per built-in module) — running the same
    // query the dialog issued is what makes it deterministic rather than timer-dependent.
    await act(async () => { await context.searchByCategory(''); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const names = rowText();
    expect(names.length).toBeGreaterThan(100);
    expect(names).toContain('SUM');

    await unmount();
  });
});
