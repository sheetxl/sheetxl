import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Workbook, EXTERNAL_LINK_PATH_REL_TYPE, type IExternalBook, type IWorkbook
} from '@sheetxl/sdk';

import { ExternalLinksPanel } from '../externalLink/ExternalLinksPanel';

/**
 * The **Workbook Links** pane's Links tab — and, through it, the shared items shell's UNAUTHORABLE
 * mode.
 *
 * @remarks
 * External links are the first list that can be acted on but not authored: a link is made by
 * typing a formula that cites a book, and the book is an immutable snapshot, so the shell offers
 * no add button, no edit action and no editor (`ItemsDescriptor.createDraft`). That absence is
 * what the second case here guards — every other list still supplies an editor, so nothing else
 * would notice if it came back.
 *
 * Same three-slot shape as the SDK's phase-C test — `[1]` a book, `[2]` a DDE/OLE gap, `[3]` a
 * book — so that a slot the pane does not render stays under test.
 */
const BOOKS: (IExternalBook.JSON | null)[] = [
  {
    sources: [{
      type: EXTERNAL_LINK_PATH_REL_TYPE,
      target: 'file:///C:/Users/me/Docs/Budget%202024.xlsx',
      role: 'book'
    }],
    sheetNames: ['Alpha', 'Data Sheet'],
    // One cached cell on the first sheet: `[major, [[minor, values]]]` — Alpha!A1 = 41.
    sheetDataSet: [{ sheetIndex: 0, data: [[0, [[0, [41]]]]] }]
  },
  null,
  {
    sources: [{
      type: EXTERNAL_LINK_PATH_REL_TYPE,
      target: 'https://example.com/files/Other.xlsx',
      role: 'book'
    }],
    sheetNames: ['P3.1']
  }
];

describe('ExternalLinksPanel', () => {
  // The card's leading chip is a `PresetChip`, which resolves the color scheme through
  // `prefers-color-scheme` — not implemented by this jsdom. Light is what a default browser would
  // answer anyway. Same shim, for the same reason, as `NamedDetailsPanel.jsdom.test.ts`.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const newWorkbook = async (books: (IExternalBook.JSON | null)[] = BOOKS): Promise<IWorkbook> => {
    const workbook = new Workbook({
      json: { sheets: [{ name: 'Sheet1' }], externalBooks: books }
    } as any);
    await workbook.whenCalculationReady();
    return workbook;
  };

  const mount = async (workbook: IWorkbook) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ExternalLinksPanel as never, { workbook }));
    });
    const buttonNamed = (label: string): HTMLElement | null =>
      (Array.from(container.querySelectorAll('button')) as HTMLElement[])
        .find((each: HTMLElement) => (each.textContent ?? '').includes(label)) ?? null;
    return {
      container,
      text: () => container.textContent ?? '',
      cards: () => Array.from(container.querySelectorAll('.sxl-item-card')) as HTMLElement[],
      buttonNamed,
      click: async (el: HTMLElement) => { await act(async () => { el.click(); }); },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('lists a row per modeled book: its file, and where that file is', async () => {
    const workbook = await newWorkbook();
    const panel = await mount(workbook);

    // Two rows, not three — the DDE/OLE slot at `[2]` has no source, no cache and no dependents.
    expect(panel.cards().length).toBe(2);
    // The file, NOT its `[n]`: a slot number is how the FILE stores the list, and no surface the
    // user sees spells one.
    expect(panel.text()).toContain('Budget 2024.xlsx');
    expect(panel.text()).toContain('Other.xlsx');
    expect(panel.text()).not.toContain('[1]');
    expect(panel.text()).not.toContain('[3]');
    // WHERE the file is, not how a formula spells it — no brackets, and a real directory.
    expect(panel.text()).toContain('C:\\Users\\me\\Docs\\Budget 2024.xlsx');
    expect(panel.text()).not.toContain('[Budget 2024.xlsx]');
    // Cached is not the same as empty: one sheet of the first was cached, none of the second.
    expect(panel.text()).toContain('Cached sheets: Alpha');
    expect(panel.text()).toContain('No cached values');

    await panel.unmount();
  });

  it('offers no way to author one — no add affordance, and one action per card', async () => {
    const workbook = await newWorkbook();
    const panel = await mount(workbook);

    // Break link, and nothing else: no edit action, because there is no editor to open.
    for (const card of panel.cards()) {
      expect(card.querySelectorAll('.anchor-item-card-actions button').length).toBe(1);
    }

    const empty = await mount(await newWorkbook([]));
    expect(empty.text()).toContain('does not link to another workbook');
    // Break all is present but disabled with nothing to break; nothing else is offered at all —
    // an authorable list would have put a "New…" button here.
    expect(empty.container.querySelectorAll('button:not([disabled])').length).toBe(0);

    await empty.unmount();
    await panel.unmount();
  });

  it('counts the formulas that cite a book', async () => {
    const workbook = await newWorkbook();
    workbook.getRange('Sheet1!B2').setFormula('=[1]Alpha!A1');
    workbook.getRange('Sheet1!B5').setFormula('=[1]Alpha!A2');
    await workbook.whenCalculationReady();

    const panel = await mount(workbook);
    expect(panel.text()).toContain('Formulas using it (2)');
    expect(panel.text()).toContain('Formulas using it (0)'); // the other book

    await panel.unmount();
  });

  it('locates a book whose OWN path is relative by its absolute companion', async () => {
    /* The `alternateUrls` shape: the
       book's own rel is a bare relative name and the xxl21 companion is what actually locates the
       file. Spelling the card from the book's own path repeated the title and said nothing. */
    const workbook = await newWorkbook([{
      sources: [
        { type: EXTERNAL_LINK_PATH_REL_TYPE, target: 'Sibling.xlsx', role: 'book' },
        {
          type: EXTERNAL_LINK_PATH_REL_TYPE,
          target: 'file:///C:/Team/Shared/Sibling.xlsx',
          role: 'absoluteUrl'
        }
      ],
      sheetNames: ['Only']
    }]);
    const panel = await mount(workbook);

    expect(panel.text()).toContain('Sibling.xlsx');
    expect(panel.text()).toContain('C:\\Team\\Shared\\Sibling.xlsx');

    await panel.unmount();
  });

  it('says nothing about location when no source carries one', async () => {
    const workbook = await newWorkbook([{
      sources: [{ type: EXTERNAL_LINK_PATH_REL_TYPE, target: 'Alone.xlsx', role: 'book' }],
      sheetNames: ['Only']
    }]);
    const panel = await mount(workbook);

    expect(panel.text()).toContain('Alone.xlsx');
    // The title already said the file name; a "path" that is only the file name is not one.
    expect(panel.container.querySelector('.sxl-external-link-location')).toBeNull();

    await panel.unmount();
  });

  it('breaks one link into its values, and drops the row', async () => {
    const workbook = await newWorkbook();
    const cell = workbook.getRange('Sheet1!B2');
    cell.setFormula('=[1]Alpha!A1');
    await workbook.whenCalculationReady();

    const panel = await mount(workbook);
    const breakLink = panel.cards()[0]
      .querySelector('.anchor-item-card-actions button') as HTMLElement;
    await panel.click(breakLink);
    await act(async () => {});

    expect(panel.cards().length).toBe(1);
    expect(panel.text()).not.toContain('Budget 2024.xlsx');
    // Excel's Break Link: the formula became its value.
    expect(cell.getFormula()).toBeNull();

    await panel.unmount();
  });

  it('breaks every link from the header', async () => {
    const workbook = await newWorkbook();
    const panel = await mount(workbook);
    expect(panel.cards().length).toBe(2);

    await panel.click(panel.buttonNamed('Break All')!);
    await act(async () => {});

    expect(panel.cards().length).toBe(0);
    expect(panel.text()).toContain('does not link to another workbook');

    await panel.unmount();
  });

  it('offers Refresh all beside Break all, and leaves every link as it was without a resolver', async () => {
    const workbook = await newWorkbook();
    const panel = await mount(workbook);
    const before = panel.text();
    expect(panel.buttonNamed('Refresh All')).not.toBeNull();

    await panel.click(panel.buttonNamed('Refresh All')!);
    await act(async () => {});

    expect(panel.cards().length).toBe(2);
    expect(panel.text()).toEqual(before);
    expect(workbook.getRange('Sheet1!A1').getValue()).toBeNull();

    await panel.unmount();
  });

  it('re-renders when a book is added behind it', async () => {
    const workbook = await newWorkbook([]);
    const panel = await mount(workbook);
    expect(panel.text()).not.toContain('Later.xlsx');

    await act(async () => {
      workbook.getExternalBooks().add({ sources: 'C:\\dir\\Later.xlsx', sheetNames: ['Sheet1'] });
    });
    expect(panel.text()).toContain('Later.xlsx');

    await panel.unmount();
  });
});
